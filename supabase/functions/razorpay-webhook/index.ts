import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.8";
import { encodeHex } from "https://deno.land/std@0.224.0/encoding/hex.ts";

async function hmacSha256(secret: string, body: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body));
  return encodeHex(new Uint8Array(sig));
}

Deno.serve(async (req) => {
  try {
    const raw = await req.text();
    const signature = req.headers.get("x-razorpay-signature") ?? "";
    const secret = Deno.env.get("RAZORPAY_WEBHOOK_SECRET") ?? "";
    const mock = Deno.env.get("MOCK_PROVIDERS") === "true";

    let signatureValid = false;
    if (mock && !secret) {
      signatureValid = true;
    } else if (secret) {
      const expected = await hmacSha256(secret, raw);
      signatureValid = expected === signature;
    }

    if (!signatureValid) {
      return new Response(JSON.stringify({ error: "WEBHOOK_SIGNATURE_INVALID" }), { status: 401 });
    }

    const payload = JSON.parse(raw);
    const eventId = payload?.event_id ?? payload?.id ?? crypto.randomUUID();
    const eventType = payload?.event ?? "unknown";

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: existing } = await admin
      .from("webhook_events")
      .select("id, processing_status")
      .eq("provider", "razorpay")
      .eq("provider_event_id", String(eventId))
      .maybeSingle();

    if (existing?.processing_status === "processed") {
      return new Response(JSON.stringify({ ok: true, deduped: true }), { status: 200 });
    }

    await admin.from("webhook_events").upsert({
      provider: "razorpay",
      provider_event_id: String(eventId),
      event_type: eventType,
      signature_valid: true,
      processing_status: "processing",
      payload,
    }, { onConflict: "provider,provider_event_id" });

    // payment.captured / order.paid
    if (eventType === "payment.captured" || eventType === "order.paid") {
      const paymentEntity = payload?.payload?.payment?.entity ?? payload?.payload?.order?.entity;
      const providerOrderId = paymentEntity?.order_id ?? paymentEntity?.id;
      const providerPaymentId = paymentEntity?.id;

      if (providerOrderId) {
        const { data: order } = await admin
          .from("orders")
          .select("*, credit_packs(*)")
          .eq("provider_order_id", providerOrderId)
          .maybeSingle();

        if (order && order.status !== "paid") {
          await admin.from("orders").update({ status: "paid" }).eq("id", order.id);

          const { data: existingPayment } = await admin
            .from("payments")
            .select("id")
            .eq("provider", "razorpay")
            .eq("provider_payment_id", providerPaymentId)
            .maybeSingle();

          if (!existingPayment) {
            const { error: payErr } = await admin.from("payments").insert({
              user_id: order.user_id,
              order_id: order.id,
              provider: "razorpay",
              provider_payment_id: providerPaymentId,
              provider_order_id: providerOrderId,
              amount_inr: order.amount_inr,
              amount_paise: order.amount_paise,
              currency: "INR",
              status: "captured",
              captured_at: new Date().toISOString(),
              raw_metadata: paymentEntity ?? {},
            });
            if (payErr) console.error("payments insert failed", payErr);
          }

          if (order.order_type === "credit_pack" && order.credit_packs) {
            await admin.rpc("grant_purchase_credits", {
              p_user_id: order.user_id,
              p_order_id: order.id,
              p_credits: order.credit_packs.credits,
              p_validity_days: order.credit_packs.validity_days,
              p_source_type: "purchase",
              p_idempotency_key: `rzp:${providerPaymentId ?? providerOrderId}`,
            });
          }
        }
      }
    }

    await admin
      .from("webhook_events")
      .update({ processing_status: "processed", processed_at: new Date().toISOString() })
      .eq("provider", "razorpay")
      .eq("provider_event_id", String(eventId));

    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: "INTERNAL_ERROR" }), { status: 500 });
  }
});
