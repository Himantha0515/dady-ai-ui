import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { MarketingHeader } from "../layouts/MarketingHeader";
import { Button } from "../components/ui";
import { useAuth } from "../lib/auth/context";
import { useCreditPacks, usePlans } from "../hooks/useCatalog";
import { startCreditPackCheckout } from "../lib/payments/startCreditPackCheckout";
import { isRazorpayTestKey } from "../lib/payments/razorpayCheckout";
import { formatPackYieldLines } from "../lib/pricing/packYields";
import "./Pricing.css";

type BillingTab = "packs" | "monthly" | "yearly";

const planFeatures: Record<string, string[]> = {
  creator: [
    "Premium image models",
    "HD video models",
    "Priority queue",
    "Commercial usage",
    "Prompt enhancement",
    "Project history",
    "Brand kit",
    "Standard support",
  ],
  studio: [
    "Cinematic models",
    "Batch generation",
    "Higher-resolution output",
    "Multiple brand kits",
    "Faster queue",
    "Advanced workflows",
    "Premium support",
  ],
  agency: [
    "Multiple workspaces",
    "Team members",
    "Client folders",
    "Batch exports",
    "Usage reports",
    "Priority support",
  ],
};

const oneTimePackSlugs = ["mini-99", "starter-299", "plus-449"] as const;

export function Pricing() {
  const nav = useNavigate();
  const { user, profile } = useAuth();
  const { data: plans = [], isLoading: plansLoading } = usePlans();
  const { data: packs = [] } = useCreditPacks();
  const [tab, setTab] = useState<BillingTab>("packs");
  const [busy, setBusy] = useState(false);

  const oneTimePacks = useMemo(
    () =>
      oneTimePackSlugs
        .map((slug) => packs.find((p) => p.slug === slug))
        .filter((p): p is NonNullable<typeof p> => Boolean(p)),
    [packs],
  );

  const monthlyPacks = useMemo(
    () =>
      packs
        .filter(
          (p) =>
            p.slug === "creator-monthly" ||
            p.slug === "studio-monthly" ||
            (p.metadata as { billing?: string } | null)?.billing === "monthly",
        )
        .sort((a, b) => a.display_order - b.display_order),
    [packs],
  );
  const agency = plans.find((p) => p.slug === "agency");
  const usingTestKey = isRazorpayTestKey(import.meta.env.VITE_RAZORPAY_KEY_ID);

  const buyPack = async (creditPackId: string) => {
    if (!user) {
      nav(`/auth?redirect=${encodeURIComponent("/pricing")}`);
      return;
    }
    setBusy(true);
    try {
      await startCreditPackCheckout({
        creditPackId,
        email: profile?.email,
        navigate: (path) => nav(path),
      });
    } catch (err) {
      console.error(err);
      const msg = err instanceof Error ? err.message : "Could not start payment";
      alert(
        /edge function|failed to send/i.test(msg)
          ? "Payment service is unavailable right now. Please try again in a moment."
          : msg,
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="pricing">
      <MarketingHeader active="Pricing" />
      <div className="pricing-hero">
        <h1>Simple Plans for Every Creator</h1>
        <p>Start small, create more and upgrade whenever you need.</p>
        <div className="billing-toggle" role="tablist" aria-label="Billing options">
          <button
            type="button"
            role="tab"
            className={tab === "packs" ? "active" : undefined}
            aria-selected={tab === "packs"}
            onClick={() => setTab("packs")}
          >
            Credit Packs
          </button>
          <button
            type="button"
            role="tab"
            className={tab === "monthly" ? "active" : undefined}
            aria-selected={tab === "monthly"}
            onClick={() => setTab("monthly")}
          >
            Monthly Plans
          </button>
          <button
            type="button"
            role="tab"
            className={`is-soon${tab === "yearly" ? " active" : ""}`}
            aria-selected={tab === "yearly"}
            onClick={() => setTab("yearly")}
          >
            Yearly Plans <em>LAUNCHING SOON</em>
          </button>
        </div>
        <div className="pricing-note">
          No hidden fees. GST invoice on every purchase. Cancel any time.
          {usingTestKey
            ? " Payments currently run in Razorpay Test Mode — real UPI apps cannot pay test QR codes until Live keys are configured."
            : " Pay with UPI, cards, or net banking."}
        </div>
      </div>

      {tab === "yearly" ? (
        <div className="yearly-soon">
          <span className="yearly-soon-badge">Launching soon</span>
          <h2>Yearly Plans</h2>
          <p>
            Annual billing with extra savings is coming in a future update. For now, use Credit Packs
            or Monthly Plans.
          </p>
          <Button variant="ghost" disabled>
            Coming soon
          </Button>
        </div>
      ) : (
        <div className={`plan-grid${tab === "packs" ? " plan-grid--packs" : " plan-grid--monthly"}`}>
          {tab === "packs"
            ? oneTimePacks.map((pack) => {
                const popular = pack.slug === "plus-449";
                return (
                  <article key={pack.id} className={`plan-card${popular ? " popular" : ""}`}>
                    {popular ? <span className="popular-badge">Best value</span> : null}
                    <div className="plan-name">{pack.name}</div>
                    <div className="plan-price">
                      ₹{pack.price_inr}
                      <span>one time</span>
                    </div>
                    <div className="plan-credits">
                      {pack.credits} AI credits · valid {pack.validity_days} days
                    </div>
                    <Button
                      variant={popular ? "primary" : "lime"}
                      block
                      style={{ margin: "20px 0" }}
                      disabled={busy}
                      onClick={() => void buyPack(pack.id)}
                    >
                      Get {pack.credits} Credits
                    </Button>
                    <ul className="plan-yields">
                      {formatPackYieldLines(pack.credits).map((line) => (
                        <li key={line}>{line}</li>
                      ))}
                    </ul>
                    <ul>
                      <li>Watermark-free output</li>
                      <li>UPI, cards, net banking</li>
                      <li>Credits expire after {pack.validity_days} days</li>
                    </ul>
                  </article>
                );
              })
            : null}

          {tab === "monthly" ? (
            <>
              {monthlyPacks.map((p) => {
                const slug = p.slug.replace("-monthly", "");
                const popular =
                  slug === "creator" ||
                  Boolean((p.metadata as { popular?: boolean } | null)?.popular);
                return (
                  <article key={p.id} className={`plan-card${popular ? " popular" : ""}`}>
                    {popular ? <span className="popular-badge">Most popular</span> : null}
                    <div className="plan-name">{p.name}</div>
                    <div className="plan-price">
                      ₹{p.price_inr}
                      <span>/month</span>
                    </div>
                    <div className="plan-credits">
                      {p.credits.toLocaleString("en-IN")} monthly credits
                    </div>
                    <Button
                      variant={popular ? "primary" : "ghost"}
                      block
                      style={{ margin: "20px 0" }}
                      disabled={busy}
                      onClick={() => void buyPack(p.id)}
                    >
                      Choose {p.name}
                    </Button>
                    <ul className="plan-yields">
                      {formatPackYieldLines(p.credits).map((line) => (
                        <li key={line}>{line}</li>
                      ))}
                    </ul>
                    <ul>
                      {(planFeatures[slug] ?? ["Commercial usage", "Priority support"]).map((f) => (
                        <li key={f}>{f}</li>
                      ))}
                    </ul>
                  </article>
                );
              })}

              {agency ? (
                <article className="plan-card">
                  <div className="plan-name">{agency.name}</div>
                  <div className="plan-price">
                    ₹{agency.price_inr}
                    <span>/month</span>
                  </div>
                  <div className="plan-credits">
                    {agency.included_credits.toLocaleString("en-IN")} monthly credits
                  </div>
                  <Button
                    variant="ghost"
                    block
                    style={{ margin: "20px 0" }}
                    onClick={() => nav("/app/help")}
                  >
                    Talk to us
                  </Button>
                  <ul className="plan-yields">
                    {formatPackYieldLines(agency.included_credits).map((line) => (
                      <li key={line}>{line}</li>
                    ))}
                  </ul>
                  <ul>
                    {(planFeatures.agency ?? []).map((f) => (
                      <li key={f}>{f}</li>
                    ))}
                  </ul>
                </article>
              ) : null}

              {!plansLoading && monthlyPacks.length === 0 ? (
                <p className="pricing-empty">Monthly packs are being prepared.</p>
              ) : null}
            </>
          ) : null}
        </div>
      )}
    </div>
  );
}
