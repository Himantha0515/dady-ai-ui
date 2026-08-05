/**
 * Curated Image Studio lineup — exactly 10 models.
 * 4 excellent / top quality · 3 medium credits · 3 low credits
 */
export type CuratedImageTier = "excellent" | "medium" | "low";

export type CuratedImageModel = {
  friendly_name: string;
  slug: string;
  provider_model_id: string;
  tier: CuratedImageTier;
  quality_tier: "fast" | "standard" | "hd" | "premium" | "cinematic";
  display_order: number;
  description: string;
};

export const CURATED_IMAGE_MODELS: CuratedImageModel[] = [
  // —— Excellent / top (4) ——
  {
    friendly_name: "Nano Banana Pro",
    slug: "nano-banana-pro",
    provider_model_id: "fal-ai/nano-banana-pro",
    tier: "excellent",
    quality_tier: "premium",
    display_order: 1,
    description: "Top-tier Google-class image quality",
  },
  {
    friendly_name: "Ideogram V2",
    slug: "ideogram-v2",
    provider_model_id: "fal-ai/ideogram/v2",
    tier: "excellent",
    quality_tier: "premium",
    display_order: 2,
    description: "Excellent text-in-image & design shots",
  },
  {
    friendly_name: "Flux 2 Max",
    slug: "flux-2-max",
    provider_model_id: "fal-ai/flux-2-max",
    tier: "excellent",
    quality_tier: "premium",
    display_order: 3,
    description: "Flagship Flux 2 max quality",
  },
  {
    friendly_name: "FLUX 1.1 Pro Ultra",
    slug: "flux-pro-v1-1-ultra",
    provider_model_id: "fal-ai/flux-pro/v1.1-ultra",
    tier: "excellent",
    quality_tier: "cinematic",
    display_order: 4,
    description: "Ultra-high detail Flux Pro",
  },
  // —— Medium credits (3) ——
  {
    friendly_name: "Seedream 5.0 Pro",
    slug: "bytedance-seedream-v5-pro-text-to-image",
    provider_model_id: "bytedance/seedream/v5/pro/text-to-image",
    tier: "medium",
    quality_tier: "hd",
    display_order: 5,
    description: "Strong mid-tier ByteDance images",
  },
  {
    friendly_name: "FLUX Pro 1.1",
    slug: "imagen-premium",
    provider_model_id: "fal-ai/flux-pro/v1.1",
    tier: "medium",
    quality_tier: "hd",
    display_order: 6,
    description: "Reliable HD Flux Pro",
  },
  {
    friendly_name: "Recraft V3",
    slug: "recraft-v3-text-to-image",
    provider_model_id: "fal-ai/recraft/v3/text-to-image",
    tier: "medium",
    quality_tier: "hd",
    display_order: 7,
    description: "Clean design & product visuals",
  },
  // —— Low credits (3) ——
  {
    friendly_name: "FLUX Dev",
    slug: "flux-studio",
    provider_model_id: "fal-ai/flux/dev",
    tier: "low",
    quality_tier: "standard",
    display_order: 8,
    description: "Affordable everyday Flux",
  },
  {
    friendly_name: "FLUX Schnell",
    slug: "imagen-fast",
    provider_model_id: "fal-ai/flux/schnell",
    tier: "low",
    quality_tier: "fast",
    display_order: 9,
    description: "Fast low-credit drafts",
  },
  {
    friendly_name: "SDXL Fast",
    slug: "fast-sdxl",
    provider_model_id: "fal-ai/fast-sdxl",
    tier: "low",
    quality_tier: "fast",
    display_order: 10,
    description: "Cheapest quick generations",
  },
];

export const CURATED_IMAGE_SLUGS = new Set(CURATED_IMAGE_MODELS.map((m) => m.slug));
export const CURATED_IMAGE_PATHS = new Set(
  CURATED_IMAGE_MODELS.map((m) => m.provider_model_id.toLowerCase()),
);

export function isCuratedImageModel(m: {
  slug?: string | null;
  provider_model_id?: string | null;
}): boolean {
  if (m.slug && CURATED_IMAGE_SLUGS.has(m.slug)) return true;
  const path = (m.provider_model_id || "").toLowerCase();
  return CURATED_IMAGE_PATHS.has(path);
}

export function curatedImageTierLabel(tier: CuratedImageTier): string {
  if (tier === "excellent") return "Excellent";
  if (tier === "medium") return "Medium";
  return "Low credits";
}
