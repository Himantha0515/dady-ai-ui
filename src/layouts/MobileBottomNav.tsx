import { NavLink } from "react-router-dom";
import "./MobileBottomNav.css";

const tabs = [
  { to: "/app", label: "Home", icon: "⌂", end: true },
  { to: "/app/create/image", label: "Image", icon: "▣" },
  { to: "/app/video", label: "Video", icon: "▶" },
  { to: "/app/templates", label: "Gallery", icon: "▤" },
  { to: "/app/credits", label: "Credits", icon: "◇" },
];

export function MobileBottomNav() {
  return (
    <nav className="mobile-bottom-nav" aria-label="App shortcuts">
      {tabs.map((t) => (
        <NavLink
          key={t.to}
          to={t.to}
          end={t.end}
          className={({ isActive }) =>
            `mobile-bottom-nav__link${isActive ? " is-active" : ""}`
          }
        >
          <span className="mobile-bottom-nav__icon" aria-hidden>
            {t.icon}
          </span>
          <span>{t.label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
