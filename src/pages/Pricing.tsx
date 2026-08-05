import { useNavigate } from "react-router-dom";
import { MarketingHeader } from "../layouts/MarketingHeader";
import { Button } from "../components/ui";
import { useAuth } from "../lib/auth/context";
import { useCreditPacks, usePlans } from "../hooks/useCatalog";
import { paymentsApi } from "../lib/api/catalog";
import { startCreditPackCheckout } from "../lib/payments/startCreditPackCheckout";
import "./Pricing.css";

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

export function Pricing() {
  const nav = useNavigate();
  const { user, profile } = useAuth();
  const { data: plans = [], isLoading: plansLoading } = usePlans();
  const { data: packs = [] } = useCreditPacks();
  const mini = packs[0];

  const requireAuth = (path: string) => {
    if (!user) {
      nav(`/auth?redirect=${encodeURIComponent(path)}`);
      return false;
    }
    return true;
  };

  const buyPack = async () => {
    if (!mini) return;
    if (!requireAuth("/pricing")) return;

    try {
      await startCreditPackCheckout({
        creditPackId: mini.id,
        email: profile?.email,
        navigate: (path) => nav(path),
      });
    } catch (err) {
      console.error(err);
      alert(err instanceof Error ? err.message : "Could not start payment");
    }
  };

  const buyPlan = async (planId: string) => {
    if (!requireAuth("/pricing")) return;
    try {
      const sub = (await paymentsApi.createSubscription(planId, crypto.randomUUID())) as {
        subscriptionId: string;
        razorpaySubscriptionId: string;
        keyId?: string;
        mock?: boolean;
      };

      if (sub.mock || !sub.razorpaySubscriptionId || sub.razorpaySubscriptionId.startsWith("sub_mock_")) {
        alert(
          "Monthly plans need Razorpay Plan IDs first. Use the ₹99 Mini Pack for now, or send me the plan_… IDs.",
        );
        return;
      }

      nav(`/billing/processing?subscription_id=${sub.subscriptionId}`);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Could not start subscription");
    }
  };

  return (
    <div className="pricing">
      <MarketingHeader active="Pricing" />
      <div className="pricing-hero">
        <h1>Simple Plans for Every Creator</h1>
        <p>Start small, create more and upgrade whenever you need.</p>
        <div className="billing-toggle">
          <span className="active">Credit Packs</span>
          <span>Monthly Plans</span>
          <span>
            Yearly Plans <em>SAVE 20%</em>
          </span>
        </div>
        <div className="pricing-note">
          No hidden fees. GST invoice on every purchase. Cancel any time.
          Prices and credit amounts come from the backend catalog.
        </div>
      </div>

      <div className="plan-grid">
        {mini ? (
          <article className="plan-card">
            <div className="plan-name">{mini.name}</div>
            <div className="plan-price">
              ₹{mini.price_inr}
              <span>one time</span>
            </div>
            <div className="plan-credits">
              {mini.credits} AI credits · valid {mini.validity_days} days
            </div>
            <Button variant="ghost" block style={{ margin: "20px 0" }} onClick={() => void buyPack()}>
              Get {mini.credits} Credits
            </Button>
            <ul>
              <li>Watermark-free output</li>
              <li>UPI, cards, net banking</li>
              <li>Credits expire after {mini.validity_days} days</li>
            </ul>
          </article>
        ) : null}

        {plansLoading
          ? null
          : plans.map((p) => (
              <article
                key={p.id}
                className={`plan-card${p.slug === "creator" ? " popular" : ""}`}
              >
                {p.slug === "creator" ? <span className="popular-badge">Most popular</span> : null}
                <div className="plan-name">{p.name}</div>
                <div className="plan-price">
                  ₹{p.price_inr}
                  <span>/{p.billing_interval}</span>
                </div>
                <div className="plan-credits">{p.included_credits.toLocaleString("en-IN")} monthly credits</div>
                <Button
                  variant={p.slug === "creator" ? "primary" : "ghost"}
                  block
                  style={{ margin: "20px 0" }}
                  onClick={() => void buyPlan(p.id)}
                >
                  {p.slug === "agency" ? "Talk to us" : `Choose ${p.name}`}
                </Button>
                <ul>
                  {(planFeatures[p.slug] ?? ["Commercial usage", "Priority support"]).map((f) => (
                    <li key={f}>{f}</li>
                  ))}
                </ul>
              </article>
            ))}
      </div>
    </div>
  );
}
