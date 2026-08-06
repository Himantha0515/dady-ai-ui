import { NavLink } from "react-router-dom";
import "./MobileBottomNav.css";

const tabs = [
  {
    to: "/app",
    label: "Home",
    end: true,
    icon: (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden>
        <path
          d="M4.5 10.8 12 4.5l7.5 6.3V19a1.5 1.5 0 0 1-1.5 1.5h-3.75v-5.25h-4.5V20.5H6A1.5 1.5 0 0 1 4.5 19v-8.2Z"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
  {
    to: "/app/create/image",
    label: "Image",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden>
        <rect x="3.5" y="5" width="17" height="14" rx="2.5" stroke="currentColor" strokeWidth="1.7" />
        <circle cx="9" cy="10" r="1.6" fill="currentColor" />
        <path
          d="m7.5 17 3.2-3.8a1.2 1.2 0 0 1 1.8 0L15 16l1.2-1.2a1.2 1.2 0 0 1 1.7 0L20 17"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
  {
    to: "/app/video",
    label: "Video",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden>
        <rect x="3.5" y="6" width="12.5" height="12" rx="2.2" stroke="currentColor" strokeWidth="1.7" />
        <path d="m16 9.5 4.5-2.5v10L16 14.5V9.5Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    to: "/app/templates",
    label: "Gallery",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden>
        <rect x="3.5" y="4.5" width="8" height="8" rx="1.8" stroke="currentColor" strokeWidth="1.7" />
        <rect x="12.5" y="4.5" width="8" height="8" rx="1.8" stroke="currentColor" strokeWidth="1.7" />
        <rect x="3.5" y="13.5" width="8" height="6" rx="1.8" stroke="currentColor" strokeWidth="1.7" />
        <rect x="12.5" y="13.5" width="8" height="6" rx="1.8" stroke="currentColor" strokeWidth="1.7" />
      </svg>
    ),
  },
  {
    to: "/app/credits",
    label: "Credits",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden>
        <path
          d="M12 3.5 14.6 9l5.9.5-4.5 3.9 1.4 5.7L12 16.8 6.6 19.1l1.4-5.7L3.5 9.5 9.4 9 12 3.5Z"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
];

export function MobileBottomNav() {
  return (
    <nav className="mobile-bottom-nav" aria-label="App shortcuts">
      <div className="mobile-bottom-nav__glow" aria-hidden />
      {tabs.map((t) => (
        <NavLink
          key={t.to}
          to={t.to}
          end={t.end}
          className={({ isActive }) =>
            `mobile-bottom-nav__link${isActive ? " is-active" : ""}`
          }
        >
          <span className="mobile-bottom-nav__orb" aria-hidden />
          <span className="mobile-bottom-nav__icon">{t.icon}</span>
          <span className="mobile-bottom-nav__label">{t.label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
