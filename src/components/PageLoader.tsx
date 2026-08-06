import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";

/** Branded loading overlay when moving between app sections. */
export function PageLoader() {
  const location = useLocation();
  const [visible, setVisible] = useState(false);
  const [label, setLabel] = useState("Loading");

  useEffect(() => {
    const path = location.pathname;
    const nextLabel =
      path.startsWith("/app/create/image")
        ? "Opening Image Studio"
        : path.startsWith("/app/video")
          ? "Opening Video Studio"
          : path.startsWith("/app/templates")
            ? "Opening Gallery"
            : path.startsWith("/app/credits")
              ? "Opening Credits"
              : path.startsWith("/app/models")
                ? "Opening Models"
                : path === "/app" || path === "/app/"
                  ? "Opening Home"
                  : path.startsWith("/pricing")
                    ? "Opening Pricing"
                    : "Loading";

    setLabel(nextLabel);
    setVisible(true);
    const t = window.setTimeout(() => setVisible(false), 520);
    return () => window.clearTimeout(t);
  }, [location.pathname, location.search]);

  if (!visible) return null;

  return (
    <div className="route-loader" role="status" aria-live="polite" aria-label={label}>
      <div className="route-loader__card">
        <div className="route-loader__ring" aria-hidden />
        <strong>DaDy&apos;s.ai</strong>
        <span>{label}…</span>
      </div>
    </div>
  );
}
