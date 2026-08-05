/**
 * Recover videos that fal completed but our app marked failed/timeout.
 * Usage: node scripts/recover-fal-outputs.mjs
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

function loadEnv(p) {
  try {
    for (const line of readFileSync(p, "utf8").split(/\r?\n/)) {
      if (!line || line.startsWith("#") || !line.includes("=")) continue;
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

const sb = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);
const key = process.env.FAL_KEY;

function queueBases(path) {
  const p = String(path || "");
  if (p.startsWith("luma/agent/")) return ["luma/agent"];
  if (p.includes("veo")) return ["fal-ai/veo3.1"];
  if (p.includes("sora")) return ["fal-ai/sora-2"];
  if (p.includes("longcat")) return ["fal-ai/longcat-video", p];
  const stripped = p.replace(/\/text-to-video$/i, "").replace(/\/image-to-video$/i, "");
  return [stripped, p];
}

function videoUrl(result) {
  const v = result?.video;
  if (typeof v === "string") return v;
  if (v && typeof v === "object" && v.url) return v.url;
  return null;
}

const { data: gens } = await sb
  .from("generations")
  .select(
    "id, user_id, generation_type, application_status, provider_request_id, credits_reserved, credits_charged, input_configuration, model_catalog(provider_model_id, configuration)",
  )
  .eq("generation_type", "video")
  .in("application_status", ["failed_refunded", "failed", "generating", "queued"])
  .order("created_at", { ascending: false })
  .limit(30);

for (const g of gens || []) {
  const req = g.provider_request_id;
  if (!req || String(req).startsWith("mock")) continue;
  const cfg = g.model_catalog?.configuration || {};
  const path = cfg.fal_endpoint || g.model_catalog?.provider_model_id || "";
  const saved =
    typeof g.input_configuration?.fal_response_url === "string"
      ? g.input_configuration.fal_response_url
      : null;

  let url = null;
  if (saved) {
    const r = await fetch(saved, { headers: { Authorization: `Key ${key}` } });
    if (r.ok) {
      const j = await r.json();
      url = videoUrl(j);
    }
  }
  if (!url) {
    for (const b of queueBases(path)) {
      const r = await fetch(`https://queue.fal.run/${b}/requests/${req}`, {
        headers: { Authorization: `Key ${key}` },
      });
      if (!r.ok) continue;
      const j = await r.json();
      url = videoUrl(j);
      if (url) break;
    }
  }
  if (!url) {
    console.log("no video", g.id, g.application_status);
    continue;
  }

  const { data: outs } = await sb
    .from("generation_outputs")
    .select("id")
    .eq("generation_id", g.id)
    .limit(1);
  if (!outs?.length) {
    await sb.from("generation_outputs").insert({
      generation_id: g.id,
      user_id: g.user_id,
      output_type: "video",
      storage_provider: "supabase",
      storage_bucket: "outputs",
      storage_key: `outputs/${g.user_id}/${g.id}/out.mp4`,
      original_provider_url: url,
      mime_type: "video/mp4",
      metadata: { provider: "fal", recovered: true },
    });
  }

  const charged = Math.max(g.credits_charged || 0, g.credits_reserved || 0);
  await sb
    .from("generations")
    .update({
      application_status: "completed",
      provider_status: "COMPLETED",
      failure_message: null,
      credits_charged: charged || g.credits_charged,
      completed_at: new Date().toISOString(),
    })
    .eq("id", g.id);

  console.log("recovered", g.id, url.slice(0, 80));
}
