/**
 * Reprice curated video models from real fal USD rates + 40% margin.
 * Credit rule: 1 credit = $0.01 sell → fal $3 @40% margin ≈ 500 credits.
 *
 * Usage: node scripts/reprice-curated-videos.mjs
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

function loadEnv(path) {
  try {
    const text = readFileSync(path, "utf8");
    for (const line of text.split(/\r?\n/)) {
      if (!line || line.trim().startsWith("#") || !line.includes("=")) continue;
      const i = line.indexOf("=");
      const k = line.slice(0, i).trim();
      const v = line.slice(i + 1).trim();
      if (!process.env[k]) process.env[k] = v;
    }
  } catch {
    /* optional */
  }
}

loadEnv(resolve(root, "supabase/.env.local"));
loadEnv(resolve(root, ".env"));
loadEnv(resolve(root, ".env.local"));

const FX = 86;
const MARGIN = 40;
const CREDIT_USD = 0.01; // 1 credit = 1 US cent of sell price

function falUsdToCredits(unitPriceUsd) {
  const sellUsd = unitPriceUsd / (1 - MARGIN / 100);
  return Math.max(1, Math.ceil(sellUsd / CREDIT_USD));
}

/** Documented fal rates (not the misleading pricing API "units" for Seedance). */
const MODELS = [
  {
    slug: "google-veo-3-1",
    provider_model_id: "fal-ai/veo3.1",
    unit_price_usd: 0.4, // with audio
    pricing_unit: "second",
    price_usd_by_resolution: { "720p": 0.4, "1080p": 0.4, "4K": 0.6 },
  },
  {
    slug: "openai-sora-2-pro",
    provider_model_id: "fal-ai/sora-2/text-to-video",
    unit_price_usd: 0.1,
    pricing_unit: "second",
  },
  {
    slug: "kling-3-pro",
    provider_model_id: "fal-ai/kling-video/v3/pro/text-to-video",
    unit_price_usd: 0.168, // audio on
    pricing_unit: "second",
  },
  {
    slug: "seedance-2-0",
    provider_model_id: "bytedance/seedance-2.0/text-to-video",
    unit_price_usd: 0.3034,
    pricing_unit: "second",
    fal_unit: "seconds",
    price_usd_by_resolution: {
      "480p": 0.134,
      "720p": 0.3034,
      "1080p": 0.682,
      "4K": 1.555,
    },
    // Fixed Dady rates (not margin formula): 330 / 10s @720p, 660 @1080p
    credits_per_second_by_resolution: {
      "480p": 17,
      "720p": 33,
      "1080p": 66,
      "4K": 66,
    },
  },
  {
    slug: "luma-ray-3-2",
    provider_model_id: "luma/agent/ray/v3.2/text-to-video",
    unit_price_usd: 0.5,
    pricing_unit: "video",
    fal_unit: "5 seconds",
  },
  {
    slug: "ltx-video-0-9-7-distilled",
    provider_model_id: "fal-ai/ltx-video-13b-distilled",
    unit_price_usd: 0.04,
    pricing_unit: "video",
  },
  {
    slug: "hailuo-02-standard-512p",
    provider_model_id: "dady/hailuo-02-standard-512p",
    unit_price_usd: 0.045,
    pricing_unit: "second",
    fal_endpoint: "fal-ai/minimax/hailuo-02/standard/text-to-video",
    input_defaults: { resolution: "512P" },
  },
  {
    slug: "hailuo-02-standard-768p",
    provider_model_id: "dady/hailuo-02-standard-768p",
    unit_price_usd: 0.045,
    pricing_unit: "second",
    fal_endpoint: "fal-ai/minimax/hailuo-02/standard/text-to-video",
    input_defaults: { resolution: "768P" },
  },
  {
    slug: "longcat-720p",
    provider_model_id: "fal-ai/longcat-video/text-to-video/720p",
    unit_price_usd: 0.04,
    pricing_unit: "second",
  },
  {
    slug: "wan-2-5",
    provider_model_id: "fal-ai/wan-25-preview/text-to-video",
    unit_price_usd: 0.05,
    pricing_unit: "second",
  },
  {
    slug: "ltx-video-0-9-5",
    provider_model_id: "fal-ai/ltx-video-v095",
    unit_price_usd: 0.04,
    pricing_unit: "video",
  },
  {
    slug: "kling-2-1-standard",
    // Keep unique provider_model_id; fal_endpoint routes to Master T2V (Standard has no T2V).
    provider_model_id: "fal-ai/kling-video/v2.1/standard/text-to-video",
    fal_endpoint: "fal-ai/kling-video/v2.1/master/text-to-video",
    unit_price_usd: 0.28,
    pricing_unit: "second",
    friendly_name: "Kling 2.1 Master",
  },
  {
    slug: "kling-2-5-turbo-pro",
    provider_model_id: "fal-ai/kling-video/v2.5-turbo/pro/text-to-video",
    unit_price_usd: 0.07,
    pricing_unit: "second",
  },
  {
    slug: "seedance-v1-lite",
    provider_model_id: "fal-ai/bytedance/seedance/v1/lite/text-to-video",
    // token-priced; ~5s 720p estimate
    unit_price_usd: 0.18,
    pricing_unit: "video",
  },
  {
    slug: "seedance-1-5-pro",
    provider_model_id: "fal-ai/bytedance/seedance/v1.5/pro/text-to-video",
    unit_price_usd: 0.35,
    pricing_unit: "video",
  },
  {
    slug: "seedance-2-0-ultra",
    provider_model_id: "bytedance/seedance-2.0/fast/text-to-video",
    unit_price_usd: 0.2419,
    pricing_unit: "second",
    fal_unit: "seconds",
    price_usd_by_resolution: {
      "480p": 0.12,
      "720p": 0.2419,
      "1080p": 0.2419,
      "4K": 0.2419,
    },
  },
];

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const sb = createClient(url, key);

const { data: existing, error } = await sb
  .from("model_catalog")
  .select("id, slug, provider_model_id, configuration, friendly_name")
  .eq("generation_type", "video")
  .eq("active", true);

if (error) {
  console.error(error);
  process.exit(1);
}

const bySlug = new Map((existing ?? []).map((r) => [r.slug, r]));
const byEndpoint = new Map((existing ?? []).map((r) => [r.provider_model_id, r]));

console.log("Rule: 1 credit = $0.01 sell | margin", MARGIN + "% | sell = fal / 0.6\n");

for (const m of MODELS) {
  const row = bySlug.get(m.slug) || byEndpoint.get(m.provider_model_id);
  if (!row) {
    console.warn("skip missing", m.slug);
    continue;
  }
  const fixed720 = m.credits_per_second_by_resolution?.["720p"];
  const creditsPerUnit =
    typeof fixed720 === "number" ? fixed720 : falUsdToCredits(m.unit_price_usd);
  const creditCost =
    m.pricing_unit === "second" ? Math.max(5, creditsPerUnit * 5) : Math.max(5, creditsPerUnit);
  const prevCfg = row.configuration && typeof row.configuration === "object" ? row.configuration : {};
  const configuration = {
    ...prevCfg,
    curated: true,
    fal_unit: m.fal_unit ?? (m.pricing_unit === "second" ? "seconds" : "videos"),
    ...(m.fal_endpoint ? { fal_endpoint: m.fal_endpoint } : {}),
    ...(m.input_defaults ? { input_defaults: m.input_defaults } : {}),
    ...(m.price_usd_by_resolution
      ? { price_usd_by_resolution: m.price_usd_by_resolution }
      : { price_usd_by_resolution: undefined }),
    ...(m.credits_per_second_by_resolution
      ? { credits_per_second_by_resolution: m.credits_per_second_by_resolution }
      : { credits_per_second_by_resolution: undefined }),
  };
  if (!m.price_usd_by_resolution) delete configuration.price_usd_by_resolution;
  if (!m.credits_per_second_by_resolution) delete configuration.credits_per_second_by_resolution;

  const patch = {
    provider_model_id: m.provider_model_id,
    ...(m.friendly_name ? { friendly_name: m.friendly_name } : {}),
    credits_per_unit: creditsPerUnit,
    credit_cost: creditCost,
    pricing_unit: m.pricing_unit,
    provider_pricing_unit: m.fal_unit ?? m.pricing_unit,
    estimated_provider_cost_usd: m.unit_price_usd,
    estimated_provider_cost_inr: Number((m.unit_price_usd * FX).toFixed(4)),
    margin_pct: MARGIN,
    fx_usd_inr: FX,
    configuration,
  };

  const { error: upErr } = await sb.from("model_catalog").update(patch).eq("id", row.id);
  if (upErr) {
    console.error("fail", m.slug, upErr.message);
    continue;
  }

  const usd720 = m.price_usd_by_resolution?.["720p"] ?? m.unit_price_usd;
  const tenSec =
    m.pricing_unit === "second"
      ? (typeof fixed720 === "number" ? fixed720 : falUsdToCredits(usd720)) * 10
      : creditsPerUnit;
  const fal10 = m.pricing_unit === "second" ? usd720 * 10 : m.unit_price_usd;
  const note =
    typeof fixed720 === "number"
      ? "fixed"
      : `fal $${fal10.toFixed(2)} → sell $${(fal10 / (1 - MARGIN / 100)).toFixed(2)}`;
  console.log(
    `${row.friendly_name.padEnd(28)} ${String(tenSec).padStart(4)} cr / 10s@720p   ${note}`,
  );
}

console.log("\nSeedance 2.0: 330 cr @720p / 10s, 660 cr @1080p / 10s ✓");
