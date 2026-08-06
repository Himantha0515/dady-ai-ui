import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Logo } from "../components/Logo";
import { Button, CreditPill } from "../components/ui";
import { useAuth } from "../lib/auth/context";
import { RECOMMENDED_VIDEO_NAV } from "../lib/models/recommendedVideoModels";
import "./TopNav.css";

type DropItem = {
  label: string;
  desc?: string;
  to: string;
  state?: Record<string, string>;
  featured?: boolean;
  badge?: string;
};

type NavItem =
  | { label: string; to: string; items?: undefined }
  | { label: string; to?: string; items: DropItem[] };

const links: NavItem[] = [
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

const mobileQuick = [
  { label: "Home", to: "/app" },
  { label: "Image Studio", to: "/app/create/image" },
  { label: "Video Studio", to: "/app/video" },
  { label: "Templates", to: "/app/templates" },
  { label: "Models", to: "/app/models" },
  { label: "Credits", to: "/app/credits" },
  { label: "Contact", to: "/app/help" },
  { label: "Pricing", to: "/pricing" },
];

export function TopNav() {
  const navigate = useNavigate();
  const { wallet, signOut, user } = useAuth();
  const credits = wallet?.available_credits ?? 0;
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  const closeMenu = () => setMenuOpen(false);

  return (
    <header className="topnav">
      <div className="topnav-inner">
        <Logo to="/" variant="nav" />

        <nav className="topnav-links" aria-label="Primary">
          {links.map((item) =>
            item.items ? (
              <div key={item.label} className="topnav-drop">
                <button type="button" className="topnav-drop-trigger" aria-haspopup="true">
                  {item.label}
                  <span className="topnav-chevron" aria-hidden>
                    ▾
                  </span>
                </button>
                <div className="topnav-drop-panel" role="menu">
                  {item.items.map((sub) => (
                    <Link
                      key={sub.label}
                      to={sub.to}
                      state={sub.state}
                      className="topnav-drop-item"
                      role="menuitem"
                    >
                      <strong>
                        {sub.label}
                        {item.label === "Models" ? (
                          <em className={`topnav-rec-badge${sub.featured ? " topnav-rec-badge--star" : ""}`}>
                            {sub.badge ?? (sub.featured ? "★ Best value" : "Recommended")}
                          </em>
                        ) : null}
                      </strong>
                      {sub.desc ? <span>{sub.desc}</span> : null}
                    </Link>
                  ))}
                </div>
              </div>
            ) : (
              <Link key={item.label} to={item.to} className="topnav-link">
                {item.label}
              </Link>
            ),
          )}
        </nav>

        <div className="topnav-actions">
          <button
            type="button"
            className="topnav-pricing-btn"
            aria-label="Pricing"
            title="Pricing"
            onClick={() => navigate("/pricing")}
          >
            <img
              className="topnav-pricing-logo"
              src="/brand/pricing-crown.png"
              alt=""
              aria-hidden
            />
          </button>
          <CreditPill value={credits} />
          {!user ? (
            <Button variant="lime" className="topnav-cta" onClick={() => navigate("/auth?redirect=/app")}>
              Get Started
            </Button>
          ) : null}
          <button
            type="button"
            className={`topnav-burger${menuOpen ? " is-open" : ""}`}
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((v) => !v)}
          >
            <span />
            <span />
            <span />
          </button>
        </div>
      </div>

      {menuOpen ? (
        <div className="topnav-mobile" role="dialog" aria-modal="true" aria-label="Menu">
          <button type="button" className="topnav-mobile-backdrop" aria-label="Close" onClick={closeMenu} />
          <div className="topnav-mobile-panel">
            <p className="topnav-mobile-label">Quick links</p>
            <div className="topnav-mobile-list">
              {mobileQuick.map((item) => (
                <Link key={item.to} to={item.to} className="topnav-mobile-link" onClick={closeMenu}>
                  {item.label}
                </Link>
              ))}
            </div>
            {user ? (
              <button
                type="button"
                className="topnav-mobile-logout"
                onClick={() => void signOut().then(() => {
                  closeMenu();
                  navigate("/");
                })}
              >
                Log out
              </button>
            ) : (
              <Button
                variant="lime"
                onClick={() => {
                  closeMenu();
                  navigate("/auth?redirect=/app");
                }}
              >
                Get Started
              </Button>
            )}
          </div>
        </div>
      ) : null}
    </header>
  );
}
