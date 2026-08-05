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

const { data: gens } = await sb
  .from("generations")
  .select(
    "id, application_status, provider_status, provider_request_id, credits_reserved, credits_charged, failure_message, created_at, input_configuration, user_id, model_catalog(friendly_name, provider_model_id, configuration)",
  )
  .order("created_at", { ascending: false })
  .limit(40);

const longcats = (gens || []).filter((g) =>
  String(g.model_catalog?.friendly_name || g.input_configuration?.model_name || "")
    .toLowerCase()
    .includes("longcat"),
);

console.log("longcat gens", longcats.length);
for (const g of longcats) {
  console.log(
    JSON.stringify(
      {
        id: g.id,
        status: g.application_status,
        provider: g.provider_status,
        req: g.provider_request_id,
        reserved: g.credits_reserved,
        charged: g.credits_charged,
        fail: g.failure_message,
        created: g.created_at,
        fal_urls: {
          status: g.input_configuration?.fal_status_url,
          response: g.input_configuration?.fal_response_url,
          base: g.input_configuration?.fal_queue_base,
        },
      },
      null,
      2,
    ),
  );

  const req = g.provider_request_id;
  if (!req) continue;

  const urls = [
    g.input_configuration?.fal_status_url,
    g.input_configuration?.fal_response_url,
    `https://queue.fal.run/fal-ai/longcat-video/requests/${req}/status`,
    `https://queue.fal.run/fal-ai/longcat-video/requests/${req}`,
    `https://queue.fal.run/fal-ai/longcat-video/text-to-video/720p/requests/${req}/status`,
    `https://queue.fal.run/fal-ai/longcat-video/text-to-video/720p/requests/${req}`,
  ].filter(Boolean);

  for (const u of urls) {
    const r = await fetch(u, { headers: { Authorization: `Key ${key}` } });
    const t = await r.text();
    console.log("GET", r.status, u.replace("https://queue.fal.run/", ""), t.slice(0, 500));
  }

  const { data: outs } = await sb
    .from("generation_outputs")
    .select("id, original_provider_url, created_at")
    .eq("generation_id", g.id);
  console.log("outputs", outs);
}

const { data: hooks } = await sb
  .from("webhook_events")
  .select("provider_event_id, event_type, processing_status, created_at, payload")
  .eq("provider", "fal")
  .order("created_at", { ascending: false })
  .limit(20);

console.log(
  "webhooks",
  (hooks || []).map((h) => ({
    id: h.provider_event_id,
    type: h.event_type,
    status: h.processing_status,
    at: h.created_at,
    req: h.payload?.request_id,
    hasVideo: Boolean(h.payload?.payload?.video || h.payload?.video),
  })),
);
