function allowedOrigins(): string[] {
  const raw = Deno.env.get("ALLOWED_ORIGINS") ?? "http://localhost:5173";
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function originAllowed(origin: string, allowed: string[]): boolean {
  if (!origin) return false;
  return allowed.some((rule) => {
    if (rule === "*") return true;
    if (rule.includes("*")) {
      const pattern = "^" + rule.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*") + "$";
      return new RegExp(pattern).test(origin);
    }
    return rule === origin;
  });
}

/** Per-request CORS headers — supports comma-separated ALLOWED_ORIGINS. */
export function corsHeadersFor(req: Request): Record<string, string> {
  const allowed = allowedOrigins();
  const origin = req.headers.get("Origin") ?? "";
  const allowOrigin = originAllowed(origin, allowed)
    ? origin
    : allowed.includes("*")
      ? "*"
      : allowed[0] ?? "*";

  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type, x-supabase-authorization",
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS, PUT, DELETE",
    Vary: "Origin",
  };
}

/** @deprecated use corsHeadersFor(req) — kept for quick imports */
export const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-authorization",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS, PUT, DELETE",
};

export function handleOptions(req: Request) {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeadersFor(req) });
  }
  return null;
}
