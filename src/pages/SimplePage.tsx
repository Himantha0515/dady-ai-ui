import { Link } from "react-router-dom";
import { Button } from "../components/ui";

export function SimplePage({
  title,
  description,
  cta,
  to = "/app/create",
}: {
  title: string;
  description: string;
  cta?: string;
  to?: string;
}) {
  return (
    <div className="app-main" style={{ maxWidth: 720 }}>
      <h1 style={{ font: "800 32px/1.1 var(--font)", letterSpacing: "-.03em", margin: 0 }}>
        {title}
      </h1>
      <p style={{ font: "400 15px/1.6 var(--font)", color: "var(--text-muted)", margin: "12px 0 28px" }}>
        {description}
      </p>
      <div style={{ display: "flex", gap: 12 }}>
        <Link to={to}>
          <Button>{cta ?? "Open Image Studio"}</Button>
        </Link>
        <Link to="/app/video">
          <Button variant="ghost">Open Video Studio</Button>
        </Link>
      </div>
    </div>
  );
}

export function CreateHub() {
  return (
    <SimplePage
      title="Create"
      description="Pick Image or Video studio. Media placeholders are ready for the clips you’ll generate later."
      cta="Open Image Studio"
      to="/app/create/image"
    />
  );
}
