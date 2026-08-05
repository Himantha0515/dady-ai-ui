/**
 * Final curated video models shown to users.
 * provider_model_id is the fal endpoint (or a synthetic id with fal_endpoint override).
 *
 * unit_price_usd = fal cost for ONE second at the baseline resolution (usually 720p),
 * unless pricing_unit is "video" (flat per clip).
 */
export type CuratedVideoModel = {
  friendly_name: string;
  slug: string;
  provider_model_id: string;
  /** Real fal path when provider_model_id is synthetic */
  fal_endpoint?: string;
  category: string;
  quality_tier: "fast" | "standard" | "hd" | "premium" | "cinematic";
  pricing_unit: "second" | "video";
  /** Fal USD cost basis used for credit math (per second unless pricing_unit=video) */
  unit_price_usd: number;
  fal_unit: string;
  description: string;
  supports_image_input: boolean;
  display_order: number;
  /** Extra fal input defaults (e.g. resolution) */
  input_defaults?: Record<string, string | number | boolean>;
  /** Fal USD / second by output resolution (overrides unit_price_usd when present) */
  price_usd_by_resolution?: Record<string, number>;
  /** Fixed Dady credits / second by resolution (highest priority override) */
  credits_per_second_by_resolution?: Record<string, number>;
};

export const CURATED_VIDEO_MODELS: CuratedVideoModel[] = [
  {
    friendly_name: "Google Veo 3.1",
    slug: "google-veo-3-1",
    provider_model_id: "fal-ai/veo3.1",
    category: "text-to-video",
    quality_tier: "cinematic",
    pricing_unit: "second",
    unit_price_usd: 0.4, // with audio
    fal_unit: "seconds",
    description: "Google’s flagship cinematic video model",
    supports_image_input: true,
    display_order: 1,
    price_usd_by_resolution: { "720p": 0.4, "1080p": 0.4, "4K": 0.6 },
  },
  {
    friendly_name: "OpenAI Sora 2 Pro",
    slug: "openai-sora-2-pro",
    provider_model_id: "fal-ai/sora-2/text-to-video",
    category: "text-to-video",
    quality_tier: "cinematic",
    pricing_unit: "second",
    unit_price_usd: 0.1,
    fal_unit: "seconds",
    description: "OpenAI Sora 2 via fal (Pro-class quality)",
    supports_image_input: false,
    display_order: 2,
  },
  {
    friendly_name: "Kling 3 Pro",
    slug: "kling-3-pro",
    provider_model_id: "fal-ai/kling-video/v3/pro/text-to-video",
    category: "text-to-video",
    quality_tier: "cinematic",
    pricing_unit: "second",
    // fal: $0.112 audio off / $0.168 audio on (default on)
    unit_price_usd: 0.168,
    fal_unit: "seconds",
    description: "Kling 3 Pro text-to-video",
    supports_image_input: true,
    display_order: 3,
  },
  {
    friendly_name: "Seedance 2.0",
    slug: "seedance-2-0",
    provider_model_id: "bytedance/seedance-2.0/text-to-video",
    category: "text-to-video",
    quality_tier: "hd",
    pricing_unit: "second",
    // fal ~$0.30/s @720p; fixed Dady rates: 330 cr / 10s @720p, 660 @1080p
    unit_price_usd: 0.3034,
    fal_unit: "seconds",
    description: "ByteDance Seedance 2.0 (330 credits / 10s at 720p)",
    supports_image_input: true,
    display_order: 4,
    price_usd_by_resolution: {
      "480p": 0.134,
      "720p": 0.3034,
      "1080p": 0.682,
      "4K": 1.555,
    },
    credits_per_second_by_resolution: {
      "480p": 17,
      "720p": 33,
      "1080p": 66,
      "4K": 66,
    },
  },
  {
    friendly_name: "Luma Ray 3.2",
    slug: "luma-ray-3-2",
    provider_model_id: "luma/agent/ray/v3.2/text-to-video",
    category: "text-to-video",
    quality_tier: "premium",
    pricing_unit: "video",
    unit_price_usd: 0.5,
    fal_unit: "5 seconds",
    description: "Luma Ray 3.2 (priced per 5s clip)",
    supports_image_input: true,
    display_order: 5,
  },
  {
    friendly_name: "LTX Video 0.9.7 Distilled",
    slug: "ltx-video-0-9-7-distilled",
    provider_model_id: "fal-ai/ltx-video-13b-distilled",
    category: "text-to-video",
    quality_tier: "fast",
    pricing_unit: "video",
    unit_price_usd: 0.04,
    fal_unit: "videos",
    description: "Fast distilled LTX 0.9.7",
    supports_image_input: true,
    display_order: 6,
  },
  {
    friendly_name: "Hailuo 02 Standard 512p",
    slug: "hailuo-02-standard-512p",
    provider_model_id: "dady/hailuo-02-standard-512p",
    fal_endpoint: "fal-ai/minimax/hailuo-02/standard/text-to-video",
    category: "text-to-video",
    quality_tier: "standard",
    pricing_unit: "second",
    unit_price_usd: 0.045,
    fal_unit: "seconds",
    description: "MiniMax Hailuo 02 Standard at 512p",
    supports_image_input: true,
    display_order: 7,
    input_defaults: { resolution: "512P" },
  },
  {
    friendly_name: "Hailuo 02 Standard 768p",
    slug: "hailuo-02-standard-768p",
    provider_model_id: "dady/hailuo-02-standard-768p",
    fal_endpoint: "fal-ai/minimax/hailuo-02/standard/text-to-video",
    category: "text-to-video",
    quality_tier: "hd",
    pricing_unit: "second",
    unit_price_usd: 0.045,
    fal_unit: "seconds",
    description: "MiniMax Hailuo 02 Standard at 768p",
    supports_image_input: true,
    display_order: 8,
    input_defaults: { resolution: "768P" },
  },
  {
    friendly_name: "LongCat 720p",
    slug: "longcat-720p",
    provider_model_id: "fal-ai/longcat-video/text-to-video/720p",
    category: "text-to-video",
    quality_tier: "standard",
    pricing_unit: "second",
    unit_price_usd: 0.04,
    fal_unit: "seconds",
    description: "LongCat video at 720p",
    supports_image_input: true,
    display_order: 9,
  },
  {
    friendly_name: "Wan 2.5",
    slug: "wan-2-5",
    provider_model_id: "fal-ai/wan-25-preview/text-to-video",
    category: "text-to-video",
    quality_tier: "standard",
    pricing_unit: "second",
    unit_price_usd: 0.05,
    fal_unit: "seconds",
    description: "Wan 2.5 text-to-video",
    supports_image_input: true,
    display_order: 10,
  },
  {
    friendly_name: "LTX Video 0.9.5",
    slug: "ltx-video-0-9-5",
    provider_model_id: "fal-ai/ltx-video-v095",
    category: "text-to-video",
    quality_tier: "fast",
    pricing_unit: "video",
    unit_price_usd: 0.04,
    fal_unit: "videos",
    description: "LTX Video 0.9.5",
    supports_image_input: true,
    display_order: 11,
  },
  {
    // fal: Standard has no T2V — route via fal_endpoint to Master.
    friendly_name: "Kling 2.1 Master",
    slug: "kling-2-1-standard",
    provider_model_id: "fal-ai/kling-video/v2.1/standard/text-to-video",
    fal_endpoint: "fal-ai/kling-video/v2.1/master/text-to-video",
    category: "text-to-video",
    quality_tier: "hd",
    pricing_unit: "second",
    unit_price_usd: 0.28,
    fal_unit: "seconds",
    description: "Kling 2.1 Master text-to-video",
    supports_image_input: true,
    display_order: 12,
  },
  {
    friendly_name: "Kling 2.5 Turbo Pro",
    slug: "kling-2-5-turbo-pro",
    provider_model_id: "fal-ai/kling-video/v2.5-turbo/pro/text-to-video",
    category: "text-to-video",
    quality_tier: "hd",
    pricing_unit: "second",
    unit_price_usd: 0.07,
    fal_unit: "seconds",
    description: "Kling 2.5 Turbo Pro",
    supports_image_input: true,
    display_order: 13,
  },
  {
    friendly_name: "Seedance V1 Lite",
    slug: "seedance-v1-lite",
    provider_model_id: "fal-ai/bytedance/seedance/v1/lite/text-to-video",
    category: "text-to-video",
    quality_tier: "fast",
    pricing_unit: "video",
    unit_price_usd: 0.18,
    fal_unit: "1m tokens",
    description: "Seedance 1.0 Lite (token-priced; estimated per clip)",
    supports_image_input: true,
    display_order: 14,
  },
  {
    friendly_name: "Seedance 1.5 Pro",
    slug: "seedance-1-5-pro",
    provider_model_id: "fal-ai/bytedance/seedance/v1.5/pro/text-to-video",
    category: "text-to-video",
    quality_tier: "premium",
    pricing_unit: "video",
    unit_price_usd: 0.35,
    fal_unit: "1m tokens",
    description: "Seedance 1.5 Pro (token-priced; estimated per clip)",
    supports_image_input: true,
    display_order: 15,
  },
  {
    friendly_name: "Seedance 2.0 Ultra",
    slug: "seedance-2-0-ultra",
    // Ultra not published on fal — map to Seedance 2.0 Fast
    provider_model_id: "bytedance/seedance-2.0/fast/text-to-video",
    category: "text-to-video",
    quality_tier: "premium",
    pricing_unit: "second",
    unit_price_usd: 0.2419,
    fal_unit: "seconds",
    description: "Seedance 2.0 Fast (mapped as Ultra — Ultra SKU not on fal yet)",
    supports_image_input: true,
    display_order: 16,
    price_usd_by_resolution: {
      "480p": 0.12,
      "720p": 0.2419,
      "1080p": 0.2419,
      "4K": 0.2419,
    },
  },
];
