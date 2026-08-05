import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.8";

function extractFalErrorMessage(payload: Record<string, unknown>): string {
  if (typeof payload.error === "string" && payload.error.trim()) {
    const nested = payload.payload as Record<string, unknown> | undefined;
    const detail = nested?.detail;
    if (Array.isArray(detail) && detail[0] && typeof detail[0] === "object") {
      const first = detail[0] as { msg?: string; loc?: unknown[] };
      if (first.msg) {
        const loc = Array.isArray(first.loc) ? first.loc.filter((x) => typeof x === "string").join(".") : "";
        return loc ? `${first.msg} (${loc})` : first.msg;
      }
    }
    if (typeof nested?.message === "string") return nested.message;
    return payload.error;
  }
  if (typeof payload.message === "string") return payload.message;
  return "Provider failed";
}

Deno.serve(async (req) => {
  try {
    const raw = await req.text();
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const payload = JSON.parse(raw || "{}") as Record<string, unknown>;
    const requestId = String(payload.request_id ?? payload.id ?? crypto.randomUUID());
    const status = String(payload.status ?? (payload.payload as Record<string, unknown> | undefined)?.status ?? "event");

    await admin.from("webhook_events").upsert({
      provider: "fal",
      provider_event_id: `${requestId}:${status}`,
      event_type: status,
      signature_valid: true,
      processing_status: "processing",
      payload,
    }, { onConflict: "provider,provider_event_id" });

    const { data: generation } = await admin
      .from("generations")
      .select("*")
      .eq("provider_request_id", requestId)
      .maybeSingle();

    if (!generation) {
      return new Response(JSON.stringify({ ok: true, ignored: true }), { status: 200 });
    }

    // Idempotent: already finished
    if (["completed", "failed", "failed_refunded"].includes(generation.application_status)) {
      await admin.from("webhook_events").update({
        processing_status: "processed",
        processed_at: new Date().toISOString(),
      }).eq("provider", "fal").eq("provider_event_id", `${requestId}:${status}`);
      return new Response(JSON.stringify({ ok: true, deduped: true }), { status: 200 });
    }

    const inner = (payload.payload ?? {}) as Record<string, unknown>;
    const ok =
      status === "OK" ||
      status === "COMPLETED" ||
      Boolean(inner.images) ||
      Boolean(inner.video) ||
      Boolean(payload.video);

    if (ok) {
      const images = (inner.images ?? payload.images ?? []) as unknown[];
      const video = (inner.video ?? payload.video ?? null) as
        | string
        | { url?: string; content_type?: string }
        | null;
      const firstImage = images[0] as { url?: string; content_type?: string } | string | undefined;
      const firstImageUrl =
        typeof firstImage === "string" ? firstImage : firstImage?.url ?? null;
      const videoUrl =
        typeof video === "string"
          ? video
          : video && typeof video === "object"
          ? video.url ?? null
          : null;
      const outputUrl = videoUrl ?? firstImageUrl;
      const mimeType =
        (video && typeof video === "object" && video.content_type) ||
        (typeof firstImage === "object" && firstImage?.content_type) ||
        (videoUrl ? "video/mp4" : "image/jpeg");
      const storageExt = videoUrl ? "mp4" : "jpg";

      // COMPLETED/OK with no media = validation/provider failure (e.g. bad duration). Refund.
      if (!outputUrl) {
        const failureMessage = extractFalErrorMessage(payload).slice(0, 500) ||
          "Provider finished without media. Credits refunded.";
        const { error: releaseErr } = await admin.rpc("release_generation_credits", {
          p_generation_id: generation.id,
          p_idempotency_key: `release:${generation.id}`,
          p_status: "failed_refunded",
        });
        if (releaseErr) console.error("release_generation_credits failed", releaseErr);
        await admin.from("generations").update({
          application_status: "failed_refunded",
          failure_message: failureMessage,
          provider_status: status,
          completed_at: new Date().toISOString(),
        }).eq("id", generation.id);
      } else {
        const { data: existingOut } = await admin
          .from("generation_outputs")
          .select("id")
          .eq("generation_id", generation.id)
          .limit(1);

        if (!existingOut?.length) {
          const { error: outErr } = await admin.from("generation_outputs").insert({
            generation_id: generation.id,
            user_id: generation.user_id,
            output_type: generation.generation_type,
            storage_provider: Deno.env.get("R2_BUCKET_NAME") ? "r2" : "supabase",
            storage_bucket: Deno.env.get("R2_BUCKET_NAME") ?? "outputs",
            storage_key: `outputs/${generation.user_id}/${generation.id}/out.${storageExt}`,
            original_provider_url: outputUrl,
            mime_type: mimeType,
            metadata: { provider: "fal" },
          });
          if (outErr) console.error("output insert failed", outErr);
        }

        const { error: capErr } = await admin.rpc("capture_generation_credits", {
          p_generation_id: generation.id,
          p_idempotency_key: `capture:${generation.id}`,
        });

        if (capErr) {
          console.error("capture_generation_credits failed", capErr);
          await admin.from("generations").update({
            application_status: "completed",
            credits_charged: generation.credits_reserved,
            provider_status: "COMPLETED",
            completed_at: new Date().toISOString(),
          }).eq("id", generation.id);

          const { data: wallet } = await admin
            .from("wallets")
            .select("*")
            .eq("user_id", generation.user_id)
            .single();
          if (wallet && generation.credits_reserved > 0) {
            await admin.from("wallets").update({
              reserved_credits: Math.max(0, wallet.reserved_credits - generation.credits_reserved),
              lifetime_used: wallet.lifetime_used + generation.credits_reserved,
            }).eq("user_id", generation.user_id);
          }
        } else {
          await admin.from("generations").update({
            provider_status: "COMPLETED",
          }).eq("id", generation.id);
        }
      }
    } else {
      const failureMessage = extractFalErrorMessage(payload).slice(0, 500);

      const { error: releaseErr } = await admin.rpc("release_generation_credits", {
        p_generation_id: generation.id,
        p_idempotency_key: `release:${generation.id}`,
        p_status: "failed_refunded",
      });
      if (releaseErr) console.error("release_generation_credits failed", releaseErr);

      // Always persist provider reason (RPC may not write failure_message).
      await admin.from("generations").update({
        application_status: "failed_refunded",
        failure_message: failureMessage,
        provider_status: status,
        completed_at: new Date().toISOString(),
      }).eq("id", generation.id);
    }

    await admin.from("webhook_events").update({
      processing_status: "processed",
      processed_at: new Date().toISOString(),
    }).eq("provider", "fal").eq("provider_event_id", `${requestId}:${status}`);

    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: "INTERNAL_ERROR" }), { status: 500 });
  }
});
