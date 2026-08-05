import { Link } from "react-router-dom";
import { Button } from "../../components/ui";

export function AdminHome() {
  return (
    <div className="app-main" style={{ maxWidth: 960, margin: "40px auto" }}>
      <h1>Admin</h1>
      <p style={{ color: "var(--text-muted)" }}>
        Connect this shell to secure admin RPCs for revenue, models, plans and webhooks.
        Server-side role checks are required for every mutation.
      </p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginTop: 24 }}>
        {[
          ["Users", "/admin/users"],
          ["Fal pricing", "/admin/models"],
          ["Plans", "/admin/plans"],
          ["Generations", "/admin/generations"],
          ["Payments", "/admin/payments"],
          ["Webhooks", "/admin/webhooks"],
        ].map(([label, to]) => (
          <Link key={to} to={to} className="card" style={{ padding: 18, color: "inherit" }}>
            <strong>{label}</strong>
          </Link>
        ))}
      </div>
      <div style={{ marginTop: 24 }}>
        <Link to="/app">
          <Button variant="ghost">Back to app</Button>
        </Link>
      </div>
    </div>
  );
}
