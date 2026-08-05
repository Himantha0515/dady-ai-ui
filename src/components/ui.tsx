import { forwardRef, type ButtonHTMLAttributes, type CSSProperties, type ReactNode } from "react";

export function Button({
  variant = "primary",
  size,
  block,
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "ghost" | "lime";
  size?: "lg";
  block?: boolean;
}) {
  const v =
    variant === "ghost" ? "btn-ghost" : variant === "lime" ? "btn-lime" : "btn-primary";
  return (
    <button
      className={[
        "btn",
        v,
        size === "lg" ? "btn-lg" : "",
        block ? "btn-block" : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      {...props}
    />
  );
}

export function CreditPill({
  value = 0,
  label = "credits",
  showDot = false,
}: {
  value?: number | string;
  label?: string | false;
  showDot?: boolean;
}) {
  const text =
    typeof value === "string" && /credit/i.test(value)
      ? value
      : label === false
        ? String(value)
        : `${value} ${label}`;

  return (
    <span className="credit-pill" title="Credits">
      {showDot ? <span className="credit-pill__dot" aria-hidden /> : null}
      <span className="credit-pill__value">{text}</span>
    </span>
  );
}

export function StatusBadge({
  tone,
  children,
}: {
  tone: "success" | "info" | "warning" | "error" | "muted";
  children: ReactNode;
}) {
  return <span className={`status status-${tone}`}>{children}</span>;
}

export const Chip = forwardRef<
  HTMLButtonElement,
  {
    active?: boolean;
    children: ReactNode;
    onClick?: () => void;
  }
>(function Chip({ active, children, onClick }, ref) {
  return (
    <button
      ref={ref}
      type="button"
      className={`chip${active ? " active" : ""}`}
      onClick={onClick}
    >
      {children}
    </button>
  );
});

export function Segment({
  options,
  value,
  onChange,
}: {
  options: string[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="seg">
      {options.map((opt) => (
        <button
          key={opt}
          type="button"
          className={`seg-item${value === opt ? " active" : ""}`}
          onClick={() => onChange(opt)}
        >
          {opt}
        </button>
      ))}
    </div>
  );
}

export function Placeholder({
  label,
  height,
  variant = "default",
  className = "",
  style,
}: {
  label: string;
  height?: number | string;
  variant?: "default" | "pink" | "blue" | "lime";
  className?: string;
  style?: CSSProperties;
}) {
  const v =
    variant === "pink"
      ? "placeholder placeholder-pink"
      : variant === "blue"
        ? "placeholder placeholder-blue"
        : variant === "lime"
          ? "placeholder placeholder-lime"
          : "placeholder";
  return (
    <div className={`${v} ${className}`} style={{ height, ...style }}>
      {label}
    </div>
  );
}

export function Progress({
  value,
  variant = "primary",
}: {
  value: number;
  variant?: "primary" | "info" | "enhance";
}) {
  const cls =
    variant === "info"
      ? "progress progress-info"
      : variant === "enhance"
        ? "progress progress-enhance"
        : "progress";
  return (
    <div className={cls}>
      <i style={{ width: `${value}%` }} />
    </div>
  );
}
