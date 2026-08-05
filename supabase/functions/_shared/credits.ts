/** Deno copy of credit economics helpers for edge functions. */

export const DEFAULT_FX_USD_INR = 86;
export const DEFAULT_MARGIN_PCT = 40;
/** 1 credit = $0.01 sell price (fal $3 → ~500 credits at 40% margin). */
export const CREDIT_VALUE_USD = 0.01;
export const CREDIT_VALUE_INR = DEFAULT_FX_USD_INR * CREDIT_VALUE_USD;
export const DEFAULT_VIDEO_SECONDS = 5;

export function normalizePricingUnit(unit: string | null | undefined): string {
  const u = (unit ?? "image").toLowerCase().trim();
  if (u.includes("compute")) return "compute_second";
  if (u.includes("megapixel")) return "megapixel";
  if (u === "seconds" || u === "second" || (u.includes("sec") && !u.includes("compute"))) {
    return "second";
  }
  if (u === "videos" || u === "video" || u.includes("generation") || u === "output") {
    return "video";
  }
  if (u.includes("image") || u === "img" || u === "images") return "image";
  if (u === "units" || u === "unit") return "second";
  return u || "image";
}

export function normalizeResolutionKey(resolution?: string | null): string {
  const r = (resolution ?? "720p").toString().trim().toLowerCase();
  if (r === "4k" || r === "2160p") return "4K";
  if (r.includes("1080")) return "1080p";
  if (r.includes("720")) return "720p";
  if (r.includes("480")) return "480p";
  if (r.includes("512")) return "720p";
  if (r.includes("768")) return "1080p";
  return "720p";
}

export function falUsdToCredits(
  unitPriceUsd: number,
  opts?: {
    fxUsdInr?: number;
    marginPct?: number;
    creditValueUsd?: number;
    creditValueInr?: number;
    minCredits?: number;
  },
): number {
  const marginPct = opts?.marginPct ?? DEFAULT_MARGIN_PCT;
  const creditValueUsd =
    opts?.creditValueUsd ??
    (opts?.creditValueInr != null
      ? opts.creditValueInr / (opts.fxUsdInr ?? DEFAULT_FX_USD_INR)
      : CREDIT_VALUE_USD);
  const minCredits = opts?.minCredits ?? 1;
  if (!Number.isFinite(unitPriceUsd) || unitPriceUsd <= 0) return minCredits;
  const multiplier = 1 / Math.max(0.05, 1 - marginPct / 100);
  const sellUsd = unitPriceUsd * multiplier;
  return Math.max(minCredits, Math.ceil(sellUsd / Math.max(0.0001, creditValueUsd)));
}

export function qualityTierFromUsd(unitPriceUsd: number | null | undefined, generationType: string): string {
  const p = unitPriceUsd ?? 0;
  if (generationType === "video") {
    if (p <= 0.05) return "fast";
    if (p <= 0.12) return "standard";
    if (p <= 0.25) return "hd";
    return "cinematic";
  }
  if (p <= 0.01) return "fast";
  if (p <= 0.03) return "standard";
  if (p <= 0.06) return "hd";
  return "premium";
}

export function slugFromEndpointId(endpointId: string): string {
  return endpointId
    .replace(/^fal-ai\//, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase()
    .slice(0, 80);
}

export function mapFalCategoryToGenerationType(category: string): "image" | "video" | null {
  const c = category.toLowerCase();
  if (c.includes("video")) return "video";
  if (c.includes("image") || c.includes("flux") || c.includes("inpaint") || c.includes("outpaint")) {
    return "image";
  }
  return null;
}

export function resolveCreditsPerUnit(
  model: {
    credit_cost: number;
    credits_per_unit?: number | null;
    margin_pct?: number | null;
    fx_usd_inr?: number | null;
    configuration?: Record<string, unknown> | null;
  },
  resolution?: string | null,
): number {
  const cfg = (model.configuration ?? {}) as Record<string, unknown>;
  const key = normalizeResolutionKey(resolution);

  const creditsByRes = cfg.credits_per_second_by_resolution as Record<string, number> | undefined;
  if (creditsByRes && typeof creditsByRes === "object") {
    const fixed = creditsByRes[key] ?? creditsByRes["720p"] ?? creditsByRes["1080p"];
    if (typeof fixed === "number" && fixed > 0) return Math.ceil(fixed);
  }

  const byRes = cfg.price_usd_by_resolution as Record<string, number> | undefined;
  const margin = Number(model.margin_pct ?? DEFAULT_MARGIN_PCT);
  const fx = Number(model.fx_usd_inr ?? DEFAULT_FX_USD_INR);

  if (byRes && typeof byRes === "object") {
    const usd = byRes[key] ?? byRes["720p"] ?? byRes["1080p"];
    if (typeof usd === "number" && usd > 0) {
      return falUsdToCredits(usd, { marginPct: margin, fxUsdInr: fx });
    }
  }

  const per = model.credits_per_unit;
  if (typeof per === "number" && per > 0) return per;
  return Math.max(1, model.credit_cost || 1);
}

export function estimateJobCredits(
  model: {
    generation_type: string;
    credit_cost: number;
    credits_per_unit?: number | null;
    pricing_unit?: string | null;
    margin_pct?: number | null;
    fx_usd_inr?: number | null;
    configuration?: Record<string, unknown> | null;
  },
  opts?: { durationSeconds?: number; numImages?: number; resolution?: string | null },
): number {
  const perUnit = resolveCreditsPerUnit(model, opts?.resolution);
  const unit = normalizePricingUnit(model.pricing_unit);
  const numImages = Math.max(1, opts?.numImages ?? 1);

  if (model.generation_type === "video" || unit === "second") {
    const seconds = Math.max(1, opts?.durationSeconds ?? DEFAULT_VIDEO_SECONDS);
    if (unit === "video" || unit === "generation" || unit === "compute_second") {
      return Math.max(5, perUnit * numImages);
    }
    return Math.max(1, Math.ceil(perUnit * seconds));
  }
  if (unit === "megapixel") return Math.max(1, perUnit * numImages);
  return Math.max(1, perUnit * numImages);
}
