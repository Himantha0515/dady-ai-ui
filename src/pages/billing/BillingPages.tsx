import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "../../components/ui";
import { useAuth } from "../../lib/auth/context";
import { isSupabaseConfigured, supabase } from "../../lib/supabase/client";

export function BillingProcessing() {
  const [params] = useSearchParams();
  const nav = useNavigate();
  const { refreshWallet } = useAuth();
  const orderId = params.get("order_id");
  const mock = params.get("mock") === "1";
  const [status, setStatus] = useState("waiting");

  useEffect(() => {
    if (mock) {
      const t = window.setTimeout(() => {
        nav(`/billing/success?order_id=${orderId ?? ""}`, { replace: true });
      }, 1600);
      return () => window.clearTimeout(t);
    }

    if (!orderId || !isSupabaseConfigured) return;

    let tries = 0;
    const timer = window.setInterval(async () => {
      tries += 1;
      const { data } = await supabase
        .from("orders")
        .select("status")
        .eq("id", orderId)
        .maybeSingle();

      if (data?.status === "paid") {
        window.clearInterval(timer);
        setStatus("paid");
        await refreshWallet();
        nav(`/billing/success?order_id=${orderId}`, { replace: true });
        return;
      }
      if (data?.status === "failed" || data?.status === "cancelled") {
        window.clearInterval(timer);
        nav(`/billing/failed?order_id=${orderId}`, { replace: true });
        return;
      }
      if (tries >= 40) {
        window.clearInterval(timer);
        setStatus("timeout");
      }
    }, 2000);

    return () => window.clearInterval(timer);
  }, [mock, orderId, nav, refreshWallet]);

  return (
    <div className="app-main" style={{ maxWidth: 560, margin: "80px auto", textAlign: "center" }}>
      <h1>Confirming your payment…</h1>
      <p style={{ color: "var(--text-muted)" }}>
        We wait for Razorpay webhook confirmation before adding credits. Do not close this tab.
      </p>
      {orderId ? <p style={{ fontSize: 13, color: "var(--text-dim)" }}>Order {orderId}</p> : null}
      {status === "timeout" ? (
        <p style={{ color: "var(--warning)" }}>
          Still waiting. If you paid, credits usually appear within a minute after the webhook is set.
        </p>
      ) : null}
    </div>
  );
}

export function BillingSuccess() {
  const { refreshWallet, wallet } = useAuth();
  const [params] = useSearchParams();

  useEffect(() => {
    void refreshWallet();
  }, [refreshWallet]);

  return (
    <div className="app-main" style={{ maxWidth: 560, margin: "80px auto", textAlign: "center" }}>
      <h1>Payment successful</h1>
      <p style={{ color: "var(--text-muted)" }}>
        Credits are now in your wallet{wallet ? ` (${wallet.available_credits} available)` : ""}.
      </p>
      <p style={{ fontSize: 13, color: "var(--text-dim)" }}>Order {params.get("order_id")}</p>
      <div style={{ display: "flex", gap: 12, justifyContent: "center", marginTop: 24 }}>
        <Button variant="lime" onClick={() => (window.location.href = "/app/create/image")}>
          Start Creating
        </Button>
        <Link to="/app">
          <Button variant="ghost">Dashboard</Button>
        </Link>
      </div>
    </div>
  );
}

export function BillingFailed() {
  return (
    <div className="app-main" style={{ maxWidth: 560, margin: "80px auto", textAlign: "center" }}>
      <h1>Payment failed</h1>
      <p style={{ color: "var(--text-muted)" }}>No credits were added. You can retry anytime.</p>
      <div style={{ display: "flex", gap: 12, justifyContent: "center", marginTop: 24 }}>
        <Link to="/pricing">
          <Button variant="lime">Retry Payment</Button>
        </Link>
        <Link to="/app">
          <Button variant="ghost">Back to Dashboard</Button>
        </Link>
      </div>
    </div>
  );
}
