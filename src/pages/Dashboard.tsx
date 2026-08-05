import { useNavigate } from "react-router-dom";
import { Button, Placeholder, Progress, StatusBadge } from "../components/ui";
import { useActiveSubscription, useCreditGrants, useWallet } from "../hooks/useCatalog";
import { useAuth } from "../lib/auth/context";
import "./Dashboard.css";

const quick = [
  { title: "Generate Image", credits: "from 2 credits", icon: "▣", color: "rgba(124,92,255,.15)", fg: "#A99BFF", to: "/app/create" },
  { title: "Generate Video", credits: "from 10 credits", icon: "▶", color: "rgba(224,86,193,.14)", fg: "#E9A8DC", to: "/app/video" },
  { title: "Animate Image", credits: "from 10 credits", icon: "◈", color: "rgba(59,130,246,.14)", fg: "#93BEFF", to: "/app/video" },
  { title: "Create Product Ad", credits: "from 5 credits", icon: "₹", color: "rgba(52,211,153,.13)", fg: "#34D399", to: "/app/create" },
  { title: "Create AI Avatar", credits: "from 45 credits", icon: "☺", color: "rgba(124,92,255,.15)", fg: "#A99BFF", to: "/app/create" },
  { title: "Generate Voice", credits: "from 2 credits", icon: "♪", color: "rgba(251,191,36,.13)", fg: "#FBBF24", to: "/app/create" },
  { title: "Remove Background", credits: "1 credit", icon: "⬚", color: "rgba(255,255,255,.07)", fg: "#C7CDDA", to: "/app/create" },
  { title: "Upscale Image", credits: "2 credits", icon: "⤢", color: "rgba(56,189,248,.13)", fg: "#38BDF8", to: "/app/create" },
];

const projects = [
  { name: "Diwali kurta collection", type: "Image", status: <StatusBadge tone="success">✓ Completed</StatusBadge>, credits: 20, date: "Today", tone: "default" as const },
  { name: "Cafe weekend reel", type: "Video", status: <StatusBadge tone="info">◐ Generating 62%</StatusBadge>, credits: 25, date: "Today", tone: "pink" as const },
  { name: "Property walkthrough", type: "Video", status: <StatusBadge tone="warning">⏳ Queued</StatusBadge>, credits: 45, date: "Today", tone: "blue" as const },
  { name: "Hindi voiceover — offer ad", type: "Audio", status: <StatusBadge tone="error">✕ Failed · refunded</StatusBadge>, credits: 0, date: "Yest.", tone: "default" as const },
  { name: "Ganesh Chaturthi greeting", type: "Image", status: <StatusBadge tone="success">✓ Completed</StatusBadge>, credits: 10, date: "2 Sep", tone: "pink" as const },
];

export function Dashboard() {
  const nav = useNavigate();
  const { profile } = useAuth();
  const { wallet, credits } = useWallet();
  const { data: subscription } = useActiveSubscription();
  const { data: grants = [] } = useCreditGrants();

  const monthlyAllowance = subscription?.plan?.included_credits ?? 0;
  const purchasedRemaining = grants
    .filter((g) => g.source_type === "purchase")
    .reduce((sum, g) => sum + g.credits_remaining, 0);
  const expiring = grants
    .filter((g) => g.expires_at && new Date(g.expires_at).getTime() > Date.now())
    .sort((a, b) => +new Date(a.expires_at!) - +new Date(b.expires_at!))[0];
  const usedLifetime = wallet?.lifetime_used ?? 0;
  const progressPct =
    monthlyAllowance > 0
      ? Math.min(100, Math.round((credits / monthlyAllowance) * 100))
      : Math.min(100, Math.max(8, Math.round(credits / 10)));
  const name = profile?.full_name?.split(" ")[0] || "there";

  return (
    <div className="app-main dash">
      <div className="dash-top">
        <div>
          <h1>Good evening, {name}</h1>
          <p>
            {credits} credits available
            {wallet?.reserved_credits ? ` · ${wallet.reserved_credits} reserved` : ""}.
          </p>
        </div>
        <div className="dash-top-actions">
          <div className="search">
            <span>⌕</span>
            <span>Search projects, templates…</span>
          </div>
          <button className="icon-btn" type="button" aria-label="Notifications">
            ◔
          </button>
        </div>
      </div>

      <div className="stat-grid">
        <div className="stat-credit">
          <div className="stat-label accent">Credit balance</div>
          <div className="stat-big">
            {credits}
            {monthlyAllowance > 0 ? <span> of {monthlyAllowance}</span> : null}
          </div>
          <Progress value={progressPct} variant="enhance" />
          <Button style={{ marginTop: 14 }} onClick={() => nav("/pricing")}>
            Buy Credits
          </Button>
        </div>
        <div className="stat-card">
          <div className="stat-label">Current plan</div>
          <div className="stat-title">{subscription?.plan?.name ?? "Pay as you go"}</div>
          <p>
            {subscription?.current_period_end
              ? `Renews ${new Date(subscription.current_period_end).toLocaleDateString("en-IN", {
                  day: "numeric",
                  month: "short",
                })}`
              : "Buy packs or subscribe anytime"}
          </p>
        </div>
        <div className="stat-card">
          <div className="stat-label">Used lifetime</div>
          <div className="stat-num">{usedLifetime}</div>
          <p>credits consumed</p>
        </div>
        <div className="stat-card">
          <div className="stat-label">Purchased credits</div>
          <div className="stat-num">{purchasedRemaining || wallet?.lifetime_purchased || 0}</div>
          <p className="warn">
            {expiring?.expires_at
              ? `⏳ expire ${new Date(expiring.expires_at).toLocaleDateString("en-IN", {
                  day: "numeric",
                  month: "short",
                })}`
              : "No expiry soon"}
          </p>
        </div>
      </div>

      <h2>Quick create</h2>
      <div className="quick-grid">
        {quick.map((q) => (
          <button key={q.title} type="button" className="quick-card" onClick={() => nav(q.to)}>
            <div className="quick-icon" style={{ background: q.color, color: q.fg }}>
              {q.icon}
            </div>
            <div className="quick-title">{q.title}</div>
            <div className="quick-meta">{q.credits}</div>
          </button>
        ))}
      </div>

      <div className="dash-split">
        <div>
          <div className="row-head">
            <h2>Recent projects</h2>
            <button className="linkish" type="button">View all →</button>
          </div>
          <div className="table">
            <div className="table-head">
              <span>Project</span>
              <span>Type</span>
              <span>Status</span>
              <span className="right">Credits</span>
              <span className="right">Date</span>
            </div>
            {projects.map((p) => (
              <div key={p.name} className="table-row">
                <div className="proj-cell">
                  <Placeholder label="" height={38} variant={p.tone} style={{ width: 38, borderRadius: 9, flex: "none" }} />
                  <span>{p.name}</span>
                </div>
                <span className="muted">{p.type}</span>
                <span>{p.status}</span>
                <span className="right num">{p.credits}</span>
                <span className="right muted">{p.date}</span>
              </div>
            ))}
          </div>

          <h2 style={{ marginTop: 30 }}>Continue where you left off</h2>
          <div className="continue-grid">
            {[
              ["Diwali kurta collection", "Draft · 2 of 4 outputs saved", "default"],
              ["Cafe weekend reel", "Add music before export", "pink"],
              ["Store announcement", "Awaiting your logo", "blue"],
            ].map(([t, d, tone]) => (
              <div key={t} className="continue-card">
                <Placeholder label="" height={96} variant={tone as "default" | "pink" | "blue"} />
                <div>
                  <strong>{t}</strong>
                  <p>{d}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <aside>
          <h2>Recommended for you</h2>
          <div className="rec-list">
            {[
              ["Diwali Sale Poster", "Festival · trending in India", 5, "pink"],
              ["Clothing Collection Launch", "Matches your onboarding picks", 8, "default"],
              ["Instagram Reel Pack", "Seasonal · 9:16", 25, "pink"],
            ].map(([t, d, c, tone]) => (
              <div key={t as string} className="rec-item">
                <Placeholder label="" height={48} variant={tone as "default" | "pink"} style={{ width: 48, borderRadius: 11, flex: "none" }} />
                <div>
                  <strong>{t as string}</strong>
                  <p>{d as string}</p>
                </div>
                <span className="num">{c as number}</span>
              </div>
            ))}
          </div>
          <div className="month-card">
            <h3>This month</h3>
            {[
              ["Images created", "18", 72, "#7C5CFF"],
              ["Videos created", "4", 34, "#E056C1"],
              ["Credits consumed", String(usedLifetime), Math.min(100, usedLifetime), "#38BDF8"],
              ["Storage used", "1.4 GB", 28, "#34D399"],
            ].map(([l, v, w, c]) => (
              <div key={l as string} className="month-row">
                <div className="month-label">
                  <span>{l as string}</span>
                  <span className="num">{v as string}</span>
                </div>
                <div className="progress">
                  <i style={{ width: `${w}%`, background: c as string }} />
                </div>
              </div>
            ))}
            <Button variant="ghost" block style={{ marginTop: 18 }} onClick={() => nav("/app/credits")}>
              Open credit wallet
            </Button>
          </div>
        </aside>
      </div>
    </div>
  );
}
