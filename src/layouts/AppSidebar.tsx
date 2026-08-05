import { NavLink, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { Button } from "../components/ui";
import { useAuth } from "../lib/auth/context";
import { generationsApi, wishlistApi } from "../lib/api/catalog";
import "./AppSidebar.css";

const links = [
  { to: "/app", label: "Home", icon: "⌂", end: true },
  { to: "/app/templates", label: "Templates", icon: "▤" },
  { to: "/app/projects", label: "Projects", icon: "◫", badgeKey: "projects" as const },
  { to: "/app/models", label: "Models", icon: "◈" },
  { to: "/app/wishlist", label: "Wishlist", icon: "♥", badgeKey: "wishlist" as const },
  { to: "/app/credits", label: "Credits", icon: "◇" },
  { to: "/pricing", label: "Pricing", icon: "₹" },
  { to: "/app/help", label: "Contact", icon: "?" },
];

export function AppSidebar() {
  const navigate = useNavigate();
  const { profile, wallet } = useAuth();
  const [counts, setCounts] = useState({ projects: 0, wishlist: 0 });

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const [gens, wishes] = await Promise.all([
          generationsApi.listRecent(100),
          wishlistApi.list(),
        ]);
        if (!alive) return;
        const completed = Array.isArray(gens)
          ? gens.filter(
              (g: {
                application_status?: string;
                generation_outputs?: Array<{ original_provider_url?: string | null }>;
              }) =>
                g.application_status === "completed" &&
                (g.generation_outputs ?? []).some((o) => o.original_provider_url),
            ).length
          : 0;
        setCounts({
          projects: completed,
          wishlist: Array.isArray(wishes) ? wishes.length : 0,
        });
      } catch {
        /* sidebar badges are best-effort */
      }
    };
    void load();
    const id = window.setInterval(() => void load(), 30000);
    return () => {
      alive = false;
      window.clearInterval(id);
    };
  }, []);

  const initials = (profile?.full_name || profile?.email || "U").slice(0, 1).toUpperCase();
  const credits = wallet?.available_credits ?? 0;

  return (
    <aside className="sidebar">
      <Button
        className="sidebar-cta"
        variant="lime"
        block
        onClick={() => navigate("/app/create/image")}
      >
        ✦ New Creation
      </Button>

      <nav className="sidebar-nav">
        {links.map((l) => (
          <NavLink
            key={l.to}
            to={l.to}
            end={l.end}
            className={({ isActive }) =>
              `sidebar-link${isActive ? " active" : ""}`
            }
          >
            <span className="sidebar-icon">{l.icon}</span>
            <span>{l.label}</span>
            {l.badgeKey && counts[l.badgeKey] > 0 ? (
              <span className="sidebar-badge">{counts[l.badgeKey]}</span>
            ) : null}
          </NavLink>
        ))}
      </nav>

      <div className="sidebar-plan">
        <div className="sidebar-plan-row">
          <span>Available credits</span>
          <strong>{credits}</strong>
        </div>
        <div className="progress">
          <i style={{ width: `${Math.min(100, Math.max(8, credits / 10))}%` }} />
        </div>
        <p>Live wallet balance</p>
        <Button
          variant="ghost"
          block
          style={{ marginTop: 14 }}
          onClick={() => navigate("/pricing")}
        >
          Buy Credits
        </Button>
      </div>

      <div className="sidebar-user">
        <div className="avatar">{initials}</div>
        <div>
          <div className="sidebar-user-name">{profile?.full_name || "Creator"}</div>
          <div className="sidebar-user-meta">{profile?.email || "Signed in"}</div>
        </div>
        <span className="sidebar-user-caret">⌄</span>
      </div>
    </aside>
  );
}
