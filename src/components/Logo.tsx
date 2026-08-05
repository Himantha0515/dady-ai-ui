import { Link } from "react-router-dom";
import type { CSSProperties } from "react";

const LOGO_SRC = "/brand/dadys-ai-logo.png";

type LogoVariant = "nav" | "auth" | "hero" | "compact";

const variantClass: Record<LogoVariant, string> = {
  nav: "logo--nav",
  auth: "logo--auth",
  hero: "logo--hero",
  compact: "logo--compact",
};

export function Logo({
  to = "/",
  variant = "nav",
  size,
  className = "",
}: {
  to?: string;
  variant?: LogoVariant;
  /** Optional height override in px (keeps square aspect). */
  size?: number;
  className?: string;
}) {
  const style = size ? ({ ["--logo-size"]: `${size}px` } as CSSProperties) : undefined;

  return (
    <Link
      to={to}
      className={["logo", variantClass[variant], className].filter(Boolean).join(" ")}
      style={style}
      aria-label="DaDy's.ai home"
    >
      <span className="logo-glow" aria-hidden />
      <img
        className="logo-img"
        src={LOGO_SRC}
        alt="DaDy's.ai"
        width={883}
        height={720}
        decoding="async"
      />
    </Link>
  );
}
