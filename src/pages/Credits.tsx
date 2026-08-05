import { useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Button, StatusBadge } from "../components/ui";
import {
  useActiveSubscription,
  useCreditGrants,
  useCreditTransactions,
  useModels,
  useWallet,
} from "../hooks/useCatalog";
import { estimateJobCredits } from "../lib/pricing/credits";
import type { CreditTransaction } from "../types/api";
import "./Credits.css";

function fmtDay(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

function fmtDayLong(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function daysUntil(iso: string) {
  return Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000));
}

function txAction(tx: CreditTransaction) {
  const model = tx.generations?.model_catalog?.friendly_name;
  if (model) return model;
  switch (tx.transaction_type) {
    case "PURCHASE":
      return "Credit pack purchase";
    case "SUBSCRIPTION_RENEWAL":
      return "Subscription credits";
    case "GENERATION_RESERVE":
      return "Generation";
    case "GENERATION_CAPTURE":
      return "Generation completed";
    case "GENERATION_RELEASE":
    case "GENERATION_REFUND":
      return "Refund";
    case "PROMOTIONAL_CREDIT":
      return "Promotional credit";
    case "REFERRAL_CREDIT":
      return "Referral credit";
    case "ADMIN_ADJUSTMENT":
      return "Adjustment";
    case "EXPIRY":
      return "Credits expired";
    default:
      return tx.description || tx.transaction_type;
  }
}

function txCategory(tx: CreditTransaction) {
  const type = tx.generations?.generation_type;
  if (type === "image") return "Images";
  if (type === "video") return "Videos";
  if (type === "audio") return "Audio";
  if (
    tx.transaction_type === "PURCHASE" ||
    tx.transaction_type === "SUBSCRIPTION_RENEWAL"
  ) {
    return "Purchase";
  }
  if (
    tx.transaction_type === "GENERATION_RELEASE" ||
    tx.transaction_type === "GENERATION_REFUND"
  ) {
    return "Refund";
  }
  return "Credits";
}

function txStatus(tx: CreditTransaction) {
  const status = tx.generations?.application_status;
  if (tx.transaction_type === "GENERATION_RESERVE") {
    if (status === "completed") return <StatusBadge tone="success">✓ Completed</StatusBadge>;
    if (status === "failed" || status === "failed_refunded") {
      return <StatusBadge tone="error">✕ Failed</StatusBadge>;
    }
    if (status === "cancelled" || status === "cancelled_refunded") {
      return <StatusBadge tone="muted">Cancelled</StatusBadge>;
    }
    return <StatusBadge tone="info">◐ Reserved</StatusBadge>;
  }
  if (tx.transaction_type === "GENERATION_RELEASE" || tx.transaction_type === "GENERATION_REFUND") {
    return <StatusBadge tone="error">✕ Refunded</StatusBadge>;
  }
  if (tx.transaction_type === "PURCHASE" || tx.transaction_type === "SUBSCRIPTION_RENEWAL") {
    return <StatusBadge tone="success">✓ Added</StatusBadge>;
  }
  if (tx.transaction_type === "EXPIRY") {
    return <StatusBadge tone="warning">Expired</StatusBadge>;
  }
  return <StatusBadge tone="muted">Recorded</StatusBadge>;
}

function monthKey(d: Date) {
  return `${d.getFullYear()}-${d.getMonth()}`;
}

export function Credits() {
  const nav = useNavigate();
  const { wallet, credits, refreshWallet } = useWallet();
  const { data: transactions = [], isLoading: txLoading } = useCreditTransactions(50);
  const { data: grants = [] } = useCreditGrants();
  const { data: subscription } = useActiveSubscription();
  const { data: models = [] } = useModels();

  useEffect(() => {
    void refreshWallet();
  }, [refreshWallet]);

  const purchasedRemaining = useMemo(
    () =>
      grants
        .filter((g) => g.source_type === "purchase")
        .reduce((sum, g) => sum + g.credits_remaining, 0),
    [grants],
  );

  const planRemaining = useMemo(
    () =>
      grants
        .filter((g) => g.source_type === "subscription")
        .reduce((sum, g) => sum + g.credits_remaining, 0),
    [grants],
  );

  const available = credits;
  const planShare = planRemaining > 0 ? Math.min(planRemaining, available) : Math.max(0, available - purchasedRemaining);
  const purchasedShare = Math.min(purchasedRemaining, Math.max(0, available - planShare));

  const monthlyAllowance = subscription?.plan?.included_credits ?? null;
  const resetLabel = subscription?.current_period_end
    ? `resets ${fmtDay(subscription.current_period_end)}`
    : "No active plan";

  const latestPurchase = useMemo(() => {
    return (
      grants
        .filter((g) => g.source_type === "purchase")
        .sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at))[0] ?? null
    );
  }, [grants]);

  const expiring = useMemo(() => {
    const soon = grants.filter((g) => {
      if (!g.expires_at) return false;
      const days = daysUntil(g.expires_at);
      return days > 0 && days <= 30;
    });
    const total = soon.reduce((sum, g) => sum + g.credits_remaining, 0);
    const nearest = soon.sort(
      (a, b) => +new Date(a.expires_at!) - +new Date(b.expires_at!),
    )[0];
    return { total, nearest };
  }, [grants]);

  const usageBars = useMemo(() => {
    const now = new Date();
    const months: { key: string; label: string; used: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push({
        key: monthKey(d),
        label: d.toLocaleDateString("en-IN", { month: "short" }),
        used: 0,
      });
    }
    const byKey = new Map(months.map((m) => [m.key, m]));
    for (const tx of transactions) {
      if (tx.credits >= 0) continue;
      const d = new Date(tx.created_at);
      const bucket = byKey.get(monthKey(d));
      if (bucket) bucket.used += Math.abs(tx.credits);
    }
    const max = Math.max(1, ...months.map((m) => m.used));
    return months.map((m) => ({
      ...m,
      pct: Math.round((m.used / max) * 100),
    }));
  }, [transactions]);

  const guideRows = useMemo(() => {
    const images = models.filter((m) => m.generation_type === "image" && m.active);
    const videos = models.filter((m) => m.generation_type === "video" && m.active);
    const pick = (list: typeof models, n: number) =>
      [...list]
        .sort((a, b) => (a.credit_cost ?? 0) - (b.credit_cost ?? 0))
        .slice(0, n);

    const rows: { label: string; credits: number }[] = [];
    for (const m of pick(images, 3)) {
      const chargeable = {
        ...m,
        configuration: (m.configuration ?? {}) as Record<string, unknown>,
      };
      rows.push({
        label: m.friendly_name,
        credits: estimateJobCredits(chargeable, { numImages: 1 }),
      });
    }
    for (const m of pick(videos, 4)) {
      const chargeable = {
        ...m,
        configuration: (m.configuration ?? {}) as Record<string, unknown>,
      };
      rows.push({
        label: m.friendly_name,
        credits: estimateJobCredits(chargeable, {
          durationSeconds: 10,
          resolution: "720p",
        }),
      });
    }
    return rows.slice(0, 7);
  }, [models]);

  const visibleTx = transactions.filter((tx) => tx.transaction_type !== "GENERATION_CAPTURE");

  return (
    <div className="app-main credits">
      <div className="credits-top">
        <div>
          <h1>Credits and usage</h1>
          <p>Live balance from your wallet — same as the header and sidebar.</p>
        </div>
        <div className="credits-actions">
          <span className="ghost-chip">↓ Usage report</span>
          <span className="ghost-chip" onClick={() => nav("/pricing")} role="button">
            Upgrade plan
          </span>
          <Button onClick={() => nav("/pricing")}>Buy Credits</Button>
        </div>
      </div>

      <div className="credits-stats">
        <div className="stat-credit">
          <div className="stat-label accent">Available credits</div>
          <div className="stat-big">{available}</div>
          <p>
            {planShare > 0 || purchasedShare > 0
              ? `${planShare} plan + ${purchasedShare} purchased`
              : wallet
                ? `${wallet.lifetime_purchased} purchased lifetime · ${wallet.lifetime_used} used`
                : "Loading wallet…"}
            {wallet && wallet.reserved_credits > 0
              ? ` · ${wallet.reserved_credits} reserved`
              : ""}
          </p>
        </div>
        <div className="stat-card">
          <div className="stat-label">Monthly credits</div>
          <div className="stat-num">{monthlyAllowance ?? "—"}</div>
          <p>{resetLabel}</p>
        </div>
        <div className="stat-card">
          <div className="stat-label">Purchased</div>
          <div className="stat-num">{purchasedRemaining || wallet?.lifetime_purchased || 0}</div>
          <p>
            {latestPurchase
              ? `Last pack · ${fmtDay(latestPurchase.created_at)}`
              : wallet?.lifetime_purchased
                ? `${wallet.lifetime_purchased} lifetime`
                : "No purchases yet"}
          </p>
        </div>
        <div className="stat-card warn-border">
          <div className="stat-label warn">Expiring soon</div>
          <div className="stat-num">{expiring.total}</div>
          <p>
            {expiring.nearest?.expires_at
              ? `in ${daysUntil(expiring.nearest.expires_at)} days · ${fmtDay(expiring.nearest.expires_at)}`
              : "Nothing expiring in 30 days"}
          </p>
        </div>
      </div>

      <div className="credits-mid">
        <div className="chart-card">
          <div className="chart-head">
            <span>Credit usage</span>
            <div className="mini-toggle">
              <span className="active">Monthly</span>
            </div>
          </div>
          <div className="bars">
            {usageBars.map((bar) => (
              <div key={bar.key} className="bar-col" title={`${bar.used} credits`}>
                {bar.pct ? (
                  <i style={{ height: `${Math.max(6, bar.pct)}%`, background: "#10b981" }} />
                ) : (
                  <i style={{ height: "2%", background: "rgba(255,255,255,0.08)" }} />
                )}
              </div>
            ))}
          </div>
          <div className="bar-labels">
            {usageBars.map((bar) => (
              <span key={bar.key}>{bar.label}</span>
            ))}
          </div>
        </div>
        <div className="guide-card">
          <h3>Credit-cost guide</h3>
          <p>Current catalog rates (images ×1 · videos 10s @720p).</p>
          {guideRows.length === 0 ? (
            <p>Loading models…</p>
          ) : (
            guideRows.map((row) => (
              <div key={row.label} className="guide-row">
                <span>{row.label}</span>
                <strong>{row.credits}</strong>
              </div>
            ))
          )}
        </div>
      </div>

      <h2>Transaction history</h2>
      <div className="tx-table">
        <div className="tx-head">
          {["Date", "Action", "Category", "Used", "Added", "Balance", "Project", "Status"].map(
            (h) => (
              <span key={h}>{h}</span>
            ),
          )}
        </div>
        {txLoading ? (
          <div className="tx-row">
            <span>Loading transactions…</span>
          </div>
        ) : visibleTx.length === 0 ? (
          <div className="tx-row">
            <span>No credit activity yet.</span>
          </div>
        ) : (
          visibleTx.map((tx) => {
            const used = tx.credits < 0 ? String(Math.abs(tx.credits)) : "—";
            const added = tx.credits > 0 ? `+${tx.credits}` : "—";
            const project = tx.generations?.projects?.name || "—";
            return (
              <div key={tx.id} className="tx-row">
                <span title={fmtDayLong(tx.created_at)}>{fmtDay(tx.created_at)}</span>
                <span>{txAction(tx)}</span>
                <span>{txCategory(tx)}</span>
                <span className="num">{used}</span>
                <span className="num">{added}</span>
                <span className="num">{tx.balance_after}</span>
                <span>{project}</span>
                <span>{txStatus(tx)}</span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
