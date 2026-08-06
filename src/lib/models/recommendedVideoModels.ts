/**
 * Featured video models for TopNav + picker "RECOMMENDED" badges.
 * Matched by slug and/or fal path so catalog naming drift still works.
 */
export const RECOMMENDED_VIDEO_NAV = [
  {
    label: "Seedance 1.5 Pro",
    desc: "Cheapest · best output",
    slug: "seedance-1-5-pro",
    match: /seedance\/v1\.5\/pro/i,
    to: "/app/video",
    featured: true,
    badge: "★ Best value",
  },
  {
    label: "Seedance 2.0",
    desc: "Bytedance cinematic clips",
    slug: "seedance-2-0",
    match: /seedance-2\.0\/text-to-video/i,
    to: "/app/video",
    featured: false,
    badge: "Recommended",
  },
  {
    label: "Hailuo 02 Standard 768p",
    desc: "MiniMax hailuo-02/standard",
    slug: "hailuo-02-standard-768p",
    match: /minimax\/hailuo-02\/standard/i,
    to: "/app/video",
    featured: false,
    badge: "Recommended",
  },
  {
    label: "Kling 2.5 Turbo Pro",
    desc: "kling-video/v2.5-turbo/pro",
    slug: "kling-2-5-turbo-pro",
    match: /kling-video\/v2\.5-turbo\/pro/i,
    to: "/app/video",
    featured: false,
    badge: "Recommended",
  },
  {
    label: "LTX Video 0.9.7 Distilled",
    desc: "ltx-video-13b-distilled",
    slug: "ltx-video-0-9-7-distilled",
    match: /ltx-video-13b-distilled/i,
    to: "/app/video",
    featured: false,
    badge: "Recommended",
  },
] as const;

export function falPathForModel(m: {
  slug?: string | null;
  provider_model_id?: string | null;
  configuration?: unknown;
}): string {
  const cfg = (m.configuration ?? {}) as Record<string, unknown>;
  if (typeof cfg.fal_endpoint === "string" && cfg.fal_endpoint) return cfg.fal_endpoint;
  return m.provider_model_id ?? "";
}

export function isRecommendedVideoModel(m: {
  slug?: string | null;
  provider_model_id?: string | null;
  configuration?: unknown;
  friendly_name?: string | null;
}): boolean {
  const slug = (m.slug ?? "").toLowerCase();
  const path = falPathForModel(m).toLowerCase();
  if (slug === "seedance-2-0-ultra") return false;
  return RECOMMENDED_VIDEO_NAV.some((item) => {
    if (slug && slug === item.slug) return true;
    if (item.slug === "seedance-2-0") {
      return path.includes("seedance-2.0") && path.includes("text-to-video") && !path.includes("/fast/");
    }
    if (item.slug.startsWith("hailuo-02-standard") && path.includes("hailuo-02/standard")) {
      return true;
    }
    return item.match.test(path);
  });
}

export function isFeaturedVideoModel(m: {
  slug?: string | null;
  provider_model_id?: string | null;
  configuration?: unknown;
}): boolean {
  const slug = (m.slug ?? "").toLowerCase();
  const path = falPathForModel(m).toLowerCase();
  const featured = RECOMMENDED_VIDEO_NAV.find((item) => item.featured);
  if (!featured) return false;
  if (slug && slug === featured.slug) return true;
  return featured.match.test(path);
}
