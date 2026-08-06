import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Logo } from "../components/Logo";
import { Button } from "../components/ui";
import { useAuth } from "../lib/auth/context";
import { RECOMMENDED_VIDEO_NAV } from "../lib/models/recommendedVideoModels";
import "./MarketingHeader.css";

type DropItem = {
  label: string;
  desc?: string;
  to: string;
  state?: Record<string, string>;
  recommended?: boolean;
  featured?: boolean;
  badge?: string;
};

type NavItem =
  | { label: string; to: string; items?: undefined }
  | { label: string; to?: string; items: DropItem[] };

const nav: NavItem[] = [
  {
    label: "Features",
    items: [
      { label: "Image Studio", desc: "Text to image & edits", to: "/app/create/image" },
      { label: "Video Studio", desc: "Reels & cinematic clips", to: "/app/video" },
      { label: "Templates", desc: "Festival & ad packs", to: "/app/templates" },
      { label: "Brand Kit", desc: "Logo & colors locked", to: "/app" },
    ],
  },
  {
    label: "Models",
    items: RECOMMENDED_VIDEO_NAV.map((m) => ({
      label: m.label,
      desc: m.desc,
      to: m.to,
      state: { modelName: m.label },
      recommended: true,
      featured: m.featured,
      badge: m.badge,
    })),
  },
  {
    label: "Use Cases",
    items: [
      { label: "Product Ads", desc: "Launch creatives", to: "/app/create/image" },
      { label: "Social Reels", desc: "9:16 short video", to: "/app/video" },
      { label: "Festival Packs", desc: "Seasonal campaigns", to: "/app/templates" },
      { label: "Agency Workflows", desc: "Multi-brand delivery", to: "/app" },
    ],
  },
  { label: "Templates", to: "/app/templates" },
  { label: "Pricing", to: "/pricing" },
];

export function MarketingHeader({ active }: { active?: string }) {
  const navigate = useNavigate();
  const { user, profile, wallet, signOut } = useAuth();
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

  const credits = wallet?.available_credits ?? 0;
  const displayName = profile?.full_name?.trim() || profile?.email || "Creator";
  const initial = displayName.slice(0, 1).toUpperCase();

  useEffect(() => {
    if (!profileOpen) return;
    const onPointerDown = (e: PointerEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setProfileOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [profileOpen]);

  const goAuth = () => {
    navigate("/auth?redirect=/app");
  };

  const handleLogout = async () => {
    setProfileOpen(false);
    await signOut();
    navigate("/");
  };

  return (
    <header className="mkt-header">
      <div className="mkt-header-inner">
        <Logo variant="nav" />

        <nav className="mkt-nav" aria-label="Primary">
          {nav.map((item) =>
            item.items ? (
              <div key={item.label} className="mkt-drop">
                <button
                  type="button"
                  className={`mkt-drop-trigger${active === item.label ? " active" : ""}`}
                  aria-haspopup="true"
                >
                  {item.label}
                  <span className="mkt-chevron" aria-hidden>
                    ▾
                  </span>
                </button>
                <div className="mkt-drop-panel" role="menu">
                  {item.items.map((sub) => (
                    <Link
                      key={sub.label}
                      to={sub.to}
                      state={sub.state}
                      className="mkt-drop-item"
                      role="menuitem"
                    >
                      <strong>
                        {sub.label}
                        {sub.featured ? (
                          <em className="mkt-rec-badge mkt-rec-badge--star">{sub.badge ?? "★ Best value"}</em>
                        ) : sub.recommended ? (
                          <em className="mkt-rec-badge">{sub.badge ?? "Recommended"}</em>
                        ) : null}
                      </strong>
                      {sub.desc ? <span>{sub.desc}</span> : null}
                    </Link>
                  ))}
                </div>
              </div>
            ) : (
              <Link
                key={item.label}
                to={item.to}
                className={`mkt-link${active === item.label ? " active" : ""}`}
              >
                {item.label}
              </Link>
            ),
          )}
        </nav>

        <div className="mkt-actions">
          <button
            type="button"
            className="mkt-pricing-btn"
            aria-label="Pricing"
            title="Pricing"
            onClick={() => navigate("/pricing")}
          >
            <img
              className="mkt-pricing-logo"
              src="/brand/pricing-crown.png"
              alt=""
              aria-hidden
            />
          </button>
          {user ? (
            <>
              <Button variant="ghost" className="mkt-desktop-only" onClick={() => navigate("/app")}>
                Dashboard
              </Button>
              <div
                className={`mkt-profile${profileOpen ? " open" : ""}`}
                ref={profileRef}
              >
                <button
                  type="button"
                  className="mkt-profile-trigger"
                  aria-haspopup="menu"
                  aria-expanded={profileOpen}
                  onClick={() => setProfileOpen((v) => !v)}
                >
                  <span className="mkt-profile-avatar" aria-hidden>
                    {initial}
                  </span>
                  <span className="mkt-profile-text">Profile</span>
                  <span className="mkt-chevron" aria-hidden>
                    ▾
                  </span>
                </button>
                <div className="mkt-profile-panel" role="menu">
                  <div className="mkt-profile-meta">
                    <div className="mkt-profile-name">{displayName}</div>
                    {profile?.email ? (
                      <div className="mkt-profile-email">{profile.email}</div>
                    ) : null}
                    <div className="mkt-profile-credits">
                      <span>Credits remaining</span>
                      <strong>{credits.toLocaleString("en-IN")}</strong>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="mkt-profile-item"
                    role="menuitem"
                    onClick={() => {
                      setProfileOpen(false);
                      navigate("/app");
                    }}
                  >
                    Dashboard
                  </button>
                  <button
                    type="button"
                    className="mkt-profile-item"
                    role="menuitem"
                    onClick={() => {
                      setProfileOpen(false);
                      navigate("/app/help");
                    }}
                  >
                    Help
                  </button>
                  <button
                    type="button"
                    className="mkt-profile-logout"
                    role="menuitem"
                    onClick={() => void handleLogout()}
                  >
                    Log out
                  </button>
                </div>
              </div>
            </>
          ) : (
            <>
              <Button variant="ghost" onClick={goAuth}>
                Log in
              </Button>
              <Button variant="lime" onClick={goAuth}>
                Get Started
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
