import { NavLink } from "react-router-dom";
import "./IconRail.css";

const items = [
  { to: "/app", label: "Home", icon: "⌂", end: true },
  { to: "/app/templates", label: "Temp", icon: "▤" },
  { to: "/app/projects", label: "Proj", icon: "◫" },
  { to: "/app/models", label: "Models", icon: "◈" },
  { to: "/app/wishlist", label: "Wish", icon: "♥" },
  { to: "/app/credits", label: "Credits", icon: "◇" },
];

export function IconRail({ active = "Home" }: { active?: string }) {
  return (
    <aside className="icon-rail">
      <div className="icon-rail-mark" />
      {items.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end}
          className={({ isActive }) =>
            `rail-item${isActive || active === item.label ? " active" : ""}`
          }
        >
          <span>{item.icon}</span>
          <small>{item.label}</small>
        </NavLink>
      ))}
    </aside>
  );
}
