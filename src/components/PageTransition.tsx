import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";

/** Light fade/slide on route change — avoids heavy full-screen loaders. */
export function PageTransition({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const [animKey, setAnimKey] = useState(location.pathname);

  useEffect(() => {
    setAnimKey(location.pathname + location.search);
  }, [location.pathname, location.search]);

  return (
    <div key={animKey} className="page-transition">
      {children}
    </div>
  );
}
