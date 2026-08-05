import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";

/** Thin top progress bar on navigation — much lighter than a full-screen blocker. */
export function PageLoader() {
  const location = useLocation();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setVisible(true);
    const t = window.setTimeout(() => setVisible(false), 280);
    return () => window.clearTimeout(t);
  }, [location.pathname, location.search]);

  if (!visible) return null;

  return (
    <div className="route-progress" role="status" aria-live="polite" aria-label="Loading">
      <i />
    </div>
  );
}
