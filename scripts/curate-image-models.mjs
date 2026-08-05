/**
 * Activate exactly the 10 curated image models; deactivate other image rows.
 * Usage: node scripts/curate-image-models.mjs
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

const CURATED = [
  { slug: "nano-banana-pro", provider_model_id: "fal-ai/nano-banana-pro", tier: "excellent", display_order: 1, friendly_name: "Nano Banana Pro" },
  { slug: "ideogram-v2", provider_model_id: "fal-ai/ideogram/v2", tier: "excellent", display_order: 2, friendly_name: "Ideogram V2" },
  { slug: "flux-2-max", provider_model_id: "fal-ai/flux-2-max", tier: "excellent", display_order: 3, friendly_name: "Flux 2 Max" },
  { slug: "flux-pro-v1-1-ultra", provider_model_id: "fal-ai/flux-pro/v1.1-ultra", tier: "excellent", display_order: 4, friendly_name: "FLUX 1.1 Pro Ultra" },
  { slug: "bytedance-seedream-v5-pro-text-to-image", provider_model_id: "bytedance/seedream/v5/pro/text-to-image", tier: "medium", display_order: 5, friendly_name: "Seedream 5.0 Pro" },
  { slug: "imagen-premium", provider_model_id: "fal-ai/flux-pro/v1.1", tier: "medium", display_order: 6, friendly_name: "FLUX Pro 1.1" },
  { slug: "recraft-v3-text-to-image", provider_model_id: "fal-ai/recraft/v3/text-to-image", tier: "medium", display_order: 7, friendly_name: "Recraft V3" },
  { slug: "flux-studio", provider_model_id: "fal-ai/flux/dev", tier: "low", display_order: 8, friendly_name: "FLUX Dev" },
  { slug: "imagen-fast", provider_model_id: "fal-ai/flux/schnell", tier: "low", display_order: 9, friendly_name: "FLUX Schnell" },
  { slug: "fast-sdxl", provider_model_id: "fal-ai/fast-sdxl", tier: "low", display_order: 10, friendly_name: "SDXL Fast" },
];

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const sb = createClient(url, key);
const paths = CURATED.map((m) => m.provider_model_id);
const slugs = CURATED.map((m) => m.slug);

const { data: all, error } = await sb
  .from("model_catalog")
  .select("id, slug, provider_model_id, configuration, active")
  .eq("generation_type", "image");

if (error) {
  console.error(error);
  process.exit(1);
}

const keepIds = new Set();
for (const m of CURATED) {
  const row =
    (all ?? []).find((r) => r.slug === m.slug) ||
    (all ?? []).find((r) => r.provider_model_id === m.provider_model_id);
  if (!row) {
    console.warn("MISSING", m.slug, m.provider_model_id);
    continue;
  }
  keepIds.add(row.id);
  const prev = row.configuration && typeof row.configuration === "object" ? row.configuration : {};
  const { error: upErr } = await sb
    .from("model_catalog")
    .update({
      active: true,
      friendly_name: m.friendly_name,
      display_order: m.display_order,
      quality_tier:
        m.tier === "excellent" ? (m.display_order <= 2 ? "premium" : "cinematic") : m.tier === "medium" ? "hd" : "fast",
      configuration: {
        ...prev,
        curated: true,
        curated_tier: m.tier,
      },
    })
    .eq("id", row.id);
  if (upErr) console.error("fail activate", m.slug, upErr.message);
  else console.log("ON ", m.display_order, m.friendly_name.padEnd(22), m.tier);
}

let off = 0;
for (const row of all ?? []) {
  if (keepIds.has(row.id)) continue;
  if (!row.active && !(row.configuration && row.configuration.curated)) continue;
  const prev = row.configuration && typeof row.configuration === "object" ? row.configuration : {};
  const { error: offErr } = await sb
    .from("model_catalog")
    .update({
      active: false,
      configuration: { ...prev, curated: false },
    })
    .eq("id", row.id);
  if (!offErr) off += 1;
}
console.log(`\nDeactivated ${off} non-curated image models. Kept ${keepIds.size}/10.`);
console.log("Slugs:", slugs.join(", "));
console.log("Paths:", paths.join(", "));
