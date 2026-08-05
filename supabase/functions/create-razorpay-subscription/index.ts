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
    if (!authHeader) return err(req, "AUTH_REQUIRED", "Sign in required", 401);
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData } = await userClient.auth.getUser();
    if (!userData.user) return err(req, "AUTH_REQUIRED", "Sign in required", 401);

    const body = await req.json();
    const planId = body.plan_id as string;
    const idempotencyKey = body.idempotency_key as string;
    if (!planId || !idempotencyKey) return err(req, "INVALID_INPUT", "plan_id and idempotency_key required");

    const admin = createClient(supabaseUrl, serviceKey);
    const { data: plan } = await admin.from("plans").select("*").eq("id", planId).eq("active", true).single();
    if (!plan) return err(req, "INVALID_INPUT", "Plan not found");
    if (!plan.razorpay_plan_id && !mock) {
      return err(req, "INVALID_INPUT", "Plan is missing razorpay_plan_id. Configure it in admin.");
    }

    let providerSubId = `sub_mock_${crypto.randomUUID()}`;
    if (!mock) {
      const auth = btoa(`${razorpayKeyId}:${razorpaySecret}`);
      const res = await fetch("https://api.razorpay.com/v1/subscriptions", {
        method: "POST",
        headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          plan_id: plan.razorpay_plan_id,
          total_count: 12,
          customer_notify: 1,
          notes: { user_id: userData.user.id, plan_id: planId },
        }),
      });
      if (!res.ok) return err(req, "PAYMENT_FAILED", "Could not create subscription", 502);
      const data = await res.json();
      providerSubId = data.id;
    }

    const { data: sub, error } = await admin.from("subscriptions").insert({
      user_id: userData.user.id,
      plan_id: planId,
      provider: "razorpay",
      provider_subscription_id: providerSubId,
      status: "created",
    }).select("*").single();

    if (error || !sub) return err(req, "INTERNAL_ERROR", "Could not store subscription", 500);

    return json(req, {
      subscriptionId: sub.id,
      razorpaySubscriptionId: providerSubId,
      keyId: razorpayKeyId,
      mock,
    });
  } catch (e) {
    console.error(e);
    return err(req, "INTERNAL_ERROR", "Unexpected error", 500);
  }
});
