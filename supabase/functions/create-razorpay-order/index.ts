import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.8";
import { handleOptions } from "../_shared/cors.ts";
import { err, json } from "../_shared/http.ts";

Deno.serve(async (req) => {
  const opt = handleOptions(req);
  if (opt) return opt;

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const razorpayKeyId = Deno.env.get("RAZORPAY_KEY_ID")!;
    const razorpaySecret = Deno.env.get("RAZORPAY_KEY_SECRET")!;
    const mock = Deno.env.get("MOCK_PROVIDERS") === "true";

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return err("AUTH_REQUIRED", "Sign in required", 401);

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) return err("AUTH_REQUIRED", "Sign in required", 401);

    const body = await req.json();
    const creditPackId = body.credit_pack_id as string;
    const idempotencyKey = body.idempotency_key as string;
    if (!creditPackId || !idempotencyKey) {
      return err("INVALID_INPUT", "credit_pack_id and idempotency_key are required");
    }

    const admin = createClient(supabaseUrl, serviceKey);

    const { data: existing } = await admin
      .from("orders")
      .select("*")
      .eq("idempotency_key", idempotencyKey)
      .maybeSingle();
    if (existing) {
      return json({
        orderId: existing.id,
        razorpayOrderId: existing.provider_order_id,
        amountPaise: existing.amount_paise,
        currency: existing.currency,
        keyId: razorpayKeyId,
      });
    }

    const { data: pack, error: packErr } = await admin
      .from("credit_packs")
      .select("*")
      .eq("id", creditPackId)
      .eq("active", true)
      .single();
    if (packErr || !pack) return err("INVALID_INPUT", "Credit pack not found");

    const amountPaise = pack.price_inr * 100;
    let providerOrderId = `order_mock_${crypto.randomUUID()}`;

    if (!mock) {
      const auth = btoa(`${razorpayKeyId}:${razorpaySecret}`);
      const rzpRes = await fetch("https://api.razorpay.com/v1/orders", {
        method: "POST",
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          amount: amountPaise,
          currency: "INR",
          receipt: idempotencyKey.slice(0, 40),
          notes: { credit_pack_id: creditPackId, user_id: userData.user.id },
        }),
      });
      if (!rzpRes.ok) {
        const t = await rzpRes.text();
        console.error("razorpay order failed", t);
        return err("PAYMENT_FAILED", "Could not create payment order", 502);
      }
      const rzp = await rzpRes.json();
      providerOrderId = rzp.id;
    }

    const { data: order, error: orderErr } = await admin
      .from("orders")
      .insert({
        user_id: userData.user.id,
        order_type: "credit_pack",
        credit_pack_id: creditPackId,
        provider: "razorpay",
        provider_order_id: providerOrderId,
        amount_inr: pack.price_inr,
        amount_paise: amountPaise,
        currency: "INR",
        status: "pending",
        idempotency_key: idempotencyKey,
      })
      .select("*")
      .single();

    if (orderErr || !order) {
      console.error(orderErr);
      return err("INTERNAL_ERROR", "Could not store order", 500);
    }

    return json({
      orderId: order.id,
      razorpayOrderId: providerOrderId,
      amountPaise,
      currency: "INR",
      keyId: razorpayKeyId,
      mock,
    });
  } catch (e) {
    console.error(e);
    return err("INTERNAL_ERROR", "Unexpected error", 500);
  }
});
