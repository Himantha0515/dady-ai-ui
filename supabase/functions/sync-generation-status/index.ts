import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.8";
import { handleOptions } from "../_shared/cors.ts";
import { err, json } from "../_shared/http.ts";

/**
 * Fal queue status base path.
 * Luma agent status_url is queue.fal.run/luma/agent/requests/... (not .../ray/v3.2/...).
 */
function falQueueBasePath(modelPath: string): string {
  const path = modelPath.replace(/\/+$/, "");
  if (path.startsWith("luma/agent/")) return "luma/agent";
  // longcat endpoints look like .../text-to-video/720p — queue root is fal-ai/longcat-video
  if (path.includes("longcat-video")) return "fal-ai/longcat-video";
  return path
    .replace(/\/text-to-video\/[^/]+$/i, "")
    .replace(/\/text-to-video$/i, "")
    .replace(/\/image-to-video$/i, "")
    .replace(/\/+$/, "");
}

function extractOutputUrl(result: Record<string, unknown>): {
  url: string | null;
  mime: string;
} {
  const video = result.video as { url?: string; content_type?: string } | string | undefined;
  if (typeof video === "string" && video) return { url: video, mime: "video/mp4" };
  if (video && typeof video === "object" && video.url) {
    return { url: video.url, mime: video.content_type || "video/mp4" };
  }
  const images = result.images as Array<{ url?: string; content_type?: string } | string> | undefined;
  const first = images?.[0];
  if (typeof first === "string" && first) return { url: first, mime: "image/jpeg" };
  if (first && typeof first === "object" && first.url) {
    return { url: first.url, mime: first.content_type || "image/jpeg" };
  }
  if (typeof result.image === "string") return { url: result.image, mime: "image/jpeg" };
  const imageObj = result.image as { url?: string; content_type?: string } | undefined;
  if (imageObj?.url) return { url: imageObj.url, mime: imageObj.content_type || "image/jpeg" };
  return { url: null, mime: "application/octet-stream" };
}

function extractFalResultError(result: Record<string, unknown>, httpStatus: number): string | null {
  if (typeof result.error === "string" && result.error.trim()) return result.error.slice(0, 500);
  if (typeof result.message === "string" && result.message.trim() && httpStatus >= 400) {
    return result.message.slice(0, 500);
  }
  const detail = result.detail;
  if (typeof detail === "string" && detail.trim()) return detail.slice(0, 500);
  if (Array.isArray(detail) && detail[0] && typeof detail[0] === "object") {
    const first = detail[0] as { msg?: string; loc?: unknown[]; type?: string };
    if (first.msg) {
      const loc = Array.isArray(first.loc)
        ? first.loc.filter((x) => typeof x === "string").join(".")
        : "";
      return (loc ? `${first.msg} (${loc})` : first.msg).slice(0, 500);
    }
  }
  if (httpStatus >= 400) return `Provider returned HTTP ${httpStatus}`;
  return null;
}

async function failAndRefund(
  admin: ReturnType<typeof createClient>,
  generation: { id: string },
  failMsg: string,
  falStatus: string,
) {
  // supabase-js rpc() is thenable but has no .catch(); await + check error.
  const { error: releaseErr } = await admin.rpc("release_generation_credits", {
    p_generation_id: generation.id,
    p_idempotency_key: `release-sync:${generation.id}`,
    p_status: "failed_refunded",
  });
  if (releaseErr) {
    console.error("release_generation_credits failed", releaseErr);
  }

  await admin.from("generations").update({
    application_status: "failed_refunded",
    failure_message: failMsg.slice(0, 500),
    provider_status: falStatus,
    completed_at: new Date().toISOString(),
  }).eq("id", generation.id);
}

Deno.serve(async (req) => {
  const opt = handleOptions(req);
  if (opt) return opt;

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const falKey = Deno.env.get("FAL_KEY") ?? "";

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return err("AUTH_REQUIRED", "Sign in required", 401);

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData } = await userClient.auth.getUser();
    if (!userData.user) return err("AUTH_REQUIRED", "Sign in required", 401);

    const body = await req.json().catch(() => ({}));
    const generationId = body.generation_id as string | undefined;
    const forceFail = body.force_fail === true;
    const userStop = body.user_stop === true;
    if (!generationId) return err("INVALID_INPUT", "generation_id is required");

    const admin = createClient(supabaseUrl, serviceKey);
    const { data: generation, error: genErr } = await admin
      .from("generations")
      .select("*, model_catalog(provider_model_id, configuration, generation_type)")
      .eq("id", generationId)
      .eq("user_id", userData.user.id)
      .maybeSingle();

    if (genErr || !generation) return err("NOT_FOUND", "Generation not found", 404);

    const requestId = generation.provider_request_id as string | null;
    const ageMs = Date.now() - new Date(generation.created_at).getTime();
    // Hard ceiling only — never cancel fal early (they may still finish + charge).
    const STUCK_MS = 12 * 60 * 1000;
    /** Manual Stop is only offered after this (matches UI). */
    const USER_STOP_MIN_MS = 3 * 60 * 1000;

    if (userStop && ageMs < USER_STOP_MIN_MS) {
      return err(
        "TOO_EARLY",
        "Stop is available after 3 minutes of generating.",
        400,
      );
    }

    // Allow recovery of timed-out jobs if fal later produced a video.
    const canRecoverFailed = ["failed", "failed_refunded"].includes(
      generation.application_status,
    );

    if (generation.application_status === "completed") {
      return json({
        generation_id: generation.id,
        application_status: generation.application_status,
        failure_message: generation.failure_message,
        synced: false,
      });
    }

    if (!requestId || requestId.startsWith("mock_") || !falKey) {
      if (ageMs > STUCK_MS) {
        await failAndRefund(
          admin,
          generation,
          "Generation never reached the provider. Credits refunded.",
          generation.provider_status || "NO_PROVIDER_REQUEST",
        );
        return json({
          generation_id: generation.id,
          application_status: "failed_refunded",
          failure_message: "Generation never reached the provider. Credits refunded.",
          synced: true,
        });
      }
      return json({
        generation_id: generation.id,
        application_status: generation.application_status,
        provider_status: generation.provider_status,
        synced: false,
      });
    }

    const model = generation.model_catalog as {
      provider_model_id?: string;
      configuration?: Record<string, unknown>;
      generation_type?: string;
    } | null;
    const cfg = (model?.configuration ?? {}) as Record<string, unknown>;
    const modelPath =
      (typeof cfg.fal_endpoint === "string" ? cfg.fal_endpoint : null) ||
      model?.provider_model_id ||
      "";
    if (!modelPath) {
      return json({
        generation_id: generation.id,
        application_status: generation.application_status,
        synced: false,
      });
    }

    const inputCfg = (generation.input_configuration ?? {}) as Record<string, unknown>;
    const savedStatusUrl =
      typeof inputCfg.fal_status_url === "string" ? inputCfg.fal_status_url : null;
    const savedResponseUrl =
      typeof inputCfg.fal_response_url === "string" ? inputCfg.fal_response_url : null;
    const savedCancelUrl =
      typeof inputCfg.fal_cancel_url === "string" ? inputCfg.fal_cancel_url : null;
    const queueBase =
      (typeof inputCfg.fal_queue_base === "string" && inputCfg.fal_queue_base) ||
      falQueueBasePath(modelPath);

    const statusUrl =
      savedStatusUrl || `https://queue.fal.run/${queueBase}/requests/${requestId}/status`;
    const cancelUrl =
      savedCancelUrl ||
      (savedStatusUrl
        ? savedStatusUrl.replace(/\/status\/?$/, "/cancel")
        : `https://queue.fal.run/${queueBase}/requests/${requestId}/cancel`);

    const statusRes = await fetch(statusUrl, {
      headers: { Authorization: `Key ${falKey}` },
    });
    let statusJson = await statusRes.json().catch(() => ({})) as Record<string, unknown>;

    if (statusRes.status === 404 || statusRes.status === 405) {
      await failAndRefund(
        admin,
        generation,
        "Provider job not found. Credits refunded.",
        `HTTP_${statusRes.status}`,
      );
      return json({
        generation_id: generation.id,
        application_status: "failed_refunded",
        failure_message: "Provider job not found. Credits refunded.",
        synced: true,
      });
    }

    let falStatus = String(statusJson.status ?? "UNKNOWN");

    await admin.from("generations").update({
      provider_status: falStatus,
    }).eq("id", generation.id);

    if (falStatus === "IN_QUEUE" || falStatus === "IN_PROGRESS") {
      // Already failed locally and fal still running — leave failed; Refresh later can recover.
      if (canRecoverFailed && !userStop) {
        return json({
          generation_id: generation.id,
          application_status: generation.application_status,
          provider_status: falStatus,
          synced: true,
        });
      }

      // User Stop after 3min: cancel at fal if still unpaid/unfinished, then refund Dady credits.
      if (userStop) {
        const cancelRes = await fetch(cancelUrl, {
          method: "PUT",
          headers: { Authorization: `Key ${falKey}` },
        });
        const cancelJson = await cancelRes.json().catch(() => ({})) as Record<string, unknown>;
        const cancelBodyStatus = String(cancelJson.status ?? "");

        // Job already finished at fal — pull the result instead of refunding.
        if (
          cancelRes.status === 400 ||
          cancelBodyStatus === "ALREADY_COMPLETED" ||
          cancelBodyStatus === "COMPLETED"
        ) {
          const reStatus = await fetch(statusUrl, {
            headers: { Authorization: `Key ${falKey}` },
          });
          statusJson = await reStatus.json().catch(() => ({})) as Record<string, unknown>;
          falStatus = String(statusJson.status ?? "COMPLETED");
          // Fall through to COMPLETED / FAILED handlers below.
        } else {
          const failMsg =
            "Stopped. Credits refunded (fal had not finished / charged yet).";
          await failAndRefund(admin, generation, failMsg, "USER_STOPPED");
          return json({
            generation_id: generation.id,
            application_status: "failed_refunded",
            failure_message: failMsg,
            provider_status: "USER_STOPPED",
            synced: true,
            user_stopped: true,
            fal_cancel_http: cancelRes.status,
            fal_cancel_status: cancelBodyStatus || null,
          });
        }
      }

      // Auto hard-timeout path (no cancel unless user_stop already handled).
      if (falStatus === "IN_QUEUE" || falStatus === "IN_PROGRESS") {
        if (forceFail || ageMs > STUCK_MS) {
          const failMsg =
            "No video after 12 minutes. Credits refunded. Tap Refresh later if fal still delivers the file.";
          await failAndRefund(
            admin,
            generation,
            failMsg,
            forceFail ? "CLIENT_TIMEOUT" : "STUCK_TIMEOUT",
          );
          return json({
            generation_id: generation.id,
            application_status: "failed_refunded",
            failure_message: failMsg,
            provider_status: forceFail ? "CLIENT_TIMEOUT" : "STUCK_TIMEOUT",
            synced: true,
            timed_out: true,
          });
        }
        return json({
          generation_id: generation.id,
          application_status: "generating",
          provider_status: falStatus,
          synced: true,
        });
      }
    }

    if (falStatus === "COMPLETED") {
      const resultRes = await fetch(
        savedResponseUrl || `https://queue.fal.run/${queueBase}/requests/${requestId}`,
        { headers: { Authorization: `Key ${falKey}` } },
      );
      const resultJson = await resultRes.json().catch(() => ({})) as Record<string, unknown>;
      const resultErr = extractFalResultError(resultJson, resultRes.status);
      const { url: outputUrl, mime } = extractOutputUrl(resultJson);

      // Fal sometimes marks validation failures as COMPLETED with no media.
      if (resultErr || !outputUrl) {
        const failMsg = resultErr ||
          "Provider finished without a video (likely invalid settings). Credits refunded.";
        await failAndRefund(admin, generation, failMsg, falStatus);
        return json({
          generation_id: generation.id,
          application_status: "failed_refunded",
          failure_message: failMsg,
          provider_status: falStatus,
          synced: true,
        });
      }

      const { data: existingOut } = await admin
        .from("generation_outputs")
        .select("id")
        .eq("generation_id", generation.id)
        .limit(1);

      if (!existingOut?.length) {
        const ext = mime.includes("video") ? "mp4" : "jpg";
        await admin.from("generation_outputs").insert({
          generation_id: generation.id,
          user_id: generation.user_id,
          output_type: generation.generation_type,
          storage_provider: Deno.env.get("R2_BUCKET_NAME") ? "r2" : "supabase",
          storage_bucket: Deno.env.get("R2_BUCKET_NAME") ?? "outputs",
          storage_key: `outputs/${generation.user_id}/${generation.id}/out.${ext}`,
          original_provider_url: outputUrl,
          mime_type: mime,
          metadata: {
            provider: "fal",
            synced: true,
            recovered: canRecoverFailed,
          },
        });
      }

      // Recovered after refund: just mark completed (don't re-charge).
      if (canRecoverFailed) {
        await admin.from("generations").update({
          application_status: "completed",
          provider_status: "COMPLETED",
          failure_message: null,
          completed_at: new Date().toISOString(),
        }).eq("id", generation.id);
        return json({
          generation_id: generation.id,
          application_status: "completed",
          provider_status: "COMPLETED",
          synced: true,
          recovered: true,
          output_url: outputUrl,
        });
      }

      const { error: capErr } = await admin.rpc("capture_generation_credits", {
        p_generation_id: generation.id,
        p_idempotency_key: `capture:${generation.id}`,
      });
      if (capErr) {
        console.error("capture failed", capErr);
        await admin.from("generations").update({
          application_status: "completed",
          credits_charged: generation.credits_reserved,
          provider_status: "COMPLETED",
          completed_at: new Date().toISOString(),
        }).eq("id", generation.id);
      } else {
        await admin.from("generations").update({
          provider_status: "COMPLETED",
        }).eq("id", generation.id);
      }

      return json({
        generation_id: generation.id,
        application_status: "completed",
        provider_status: "COMPLETED",
        synced: true,
        output_url: outputUrl,
      });
    }

    // FAILED / ERROR / CANCELLED / UNKNOWN after timeout
    const failMsg = String(
      statusJson.error ||
        extractFalResultError(statusJson, statusRes.status) ||
        `Provider status: ${falStatus}`,
    ).slice(0, 500);

    if (falStatus === "UNKNOWN" && ageMs < STUCK_MS) {
      return json({
        generation_id: generation.id,
        application_status: generation.application_status,
        provider_status: falStatus,
        synced: true,
      });
    }

    await failAndRefund(admin, generation, failMsg, falStatus);

    return json({
      generation_id: generation.id,
      application_status: "failed_refunded",
      failure_message: failMsg,
      provider_status: falStatus,
      synced: true,
    });
  } catch (e) {
    console.error(e);
    return err("INTERNAL_ERROR", e instanceof Error ? e.message : "Unexpected error", 500);
  }
});
