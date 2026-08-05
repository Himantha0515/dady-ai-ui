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
    "id, application_status, provider_status, provider_request_id, credits_reserved, credits_charged, failure_message, created_at, input_configuration, user_id, model_catalog(friendly_name, provider_model_id)",
  )
  .eq("generation_type", "video")
  .order("created_at", { ascending: false })
  .limit(10);

console.log(JSON.stringify(gens, null, 2));

for (const g of gens || []) {
  const req = g.provider_request_id;
  if (!req || String(req).startsWith("mock")) continue;
  const path = g.model_catalog?.provider_model_id || "";
  const bases = [];
  if (path.includes("veo")) bases.push("fal-ai/veo3.1", "fal-ai/veo3");
  if (path.includes("luma")) bases.push("luma/agent");
  if (path.includes("sora")) bases.push("fal-ai/sora-2");
  if (!bases.length) {
    bases.push(path.replace(/\/text-to-video$/i, "").replace(/\/image-to-video$/i, ""));
  }
  for (const b of bases) {
    const s = await fetch(`https://queue.fal.run/${b}/requests/${req}/status`, {
      headers: { Authorization: `Key ${key}` },
    });
    const st = await s.text();
    if (s.status === 404 || s.status === 405) continue;
    console.log("---", g.model_catalog?.friendly_name, g.id.slice(0, 8), "status", s.status, st.slice(0, 300));
    const r = await fetch(`https://queue.fal.run/${b}/requests/${req}`, {
      headers: { Authorization: `Key ${key}` },
    });
    console.log("result", r.status, (await r.text()).slice(0, 600));
    break;
  }
}

if (gens?.[0]?.user_id) {
  const { data: w } = await sb.from("wallets").select("*").eq("user_id", gens[0].user_id).single();
  console.log("wallet", {
    avail: w.available_credits,
    reserved: w.reserved_credits,
    used: w.lifetime_used,
    refunded: w.lifetime_refunded,
  });
}
