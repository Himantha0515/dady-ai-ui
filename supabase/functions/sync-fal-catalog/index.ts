import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.8";
import { handleOptions } from "../_shared/cors.ts";
import { err, json } from "../_shared/http.ts";
import {
  DEFAULT_FX_USD_INR,
  DEFAULT_MARGIN_PCT,
  DEFAULT_VIDEO_SECONDS,
  falUsdToCredits,
  mapFalCategoryToGenerationType,
  normalizePricingUnit,
  qualityTierFromUsd,
  slugFromEndpointId,
} from "../_shared/credits.ts";

const FAL_CATEGORIES = [
  "text-to-video",
  "image-to-video",
  "video-to-video",
  "text-to-image",
  "image-to-image",
];

type FalModel = {
  endpoint_id: string;
  metadata?: {
    display_name?: string;
    category?: string;
    description?: string;
    status?: string;
    thumbnail_url?: string;
    tags?: string[];
  };
};

type FalPrice = {
  endpoint_id: string;
  unit_price: number;
  unit: string;
  currency?: string;
};

async function falGet(path: string, falKey: string): Promise<Response> {
  return fetch(`https://api.fal.ai/v1${path}`, {
    headers: { Authorization: `Key ${falKey}`, Accept: "application/json" },
  });
}

async function fetchAllModels(falKey: string): Promise<FalModel[]> {
  const byId = new Map<string, FalModel>();

  for (const category of FAL_CATEGORIES) {
    let cursor: string | null = null;
    let guard = 0;
    do {
      const qs = new URLSearchParams({
        status: "active",
        category,
        limit: "100",
      });
      if (cursor) qs.set("cursor", cursor);
      const res = await falGet(`/models?${qs}`, falKey);
      if (!res.ok) {
        console.error("fal models fetch failed", category, await res.text());
        break;
      }
      const body = await res.json();
      const models = (body.models ?? body) as FalModel[];
      for (const m of models) {
        if (m?.endpoint_id) byId.set(m.endpoint_id, m);
      }
      cursor = body.next_cursor ?? null;
      guard += 1;
    } while (cursor && guard < 40);
  }

  // Catch-all page without category (filter image/video client-side)
  let cursor: string | null = null;
  let guard = 0;
  do {
    const qs = new URLSearchParams({ status: "active", limit: "100" });
    if (cursor) qs.set("cursor", cursor);
    const res = await falGet(`/models?${qs}`, falKey);
    if (!res.ok) break;
    const body = await res.json();
    for (const m of (body.models ?? []) as FalModel[]) {
      const cat = m.metadata?.category ?? "";
      if (mapFalCategoryToGenerationType(cat) && m.endpoint_id) {
        byId.set(m.endpoint_id, m);
      }
    }
    cursor = body.next_cursor ?? null;
    guard += 1;
  } while (cursor && guard < 60);

  return [...byId.values()];
}

async function fetchPricing(falKey: string, endpointIds: string[]): Promise<Map<string, FalPrice>> {
  const prices = new Map<string, FalPrice>();

  const pullChunk = async (chunk: string[]): Promise<string[]> => {
    const qs = chunk.map((id) => `endpoint_id=${encodeURIComponent(id)}`).join("&");
    for (let attempt = 0; attempt < 4; attempt++) {
      const res = await falGet(`/models/pricing?${qs}`, falKey);
      if (res.status === 429) {
        await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
        continue;
      }
      if (!res.ok) {
        console.error("fal pricing failed", res.status, await res.text());
        return chunk;
      }
      const body = await res.json();
      for (const p of (body.prices ?? []) as FalPrice[]) {
        if (p?.endpoint_id && typeof p.unit_price === "number") {
          prices.set(p.endpoint_id, p);
        }
      }
      // Re-queue ids that returned no price row
      return chunk.filter((id) => !prices.has(id));
    }
    return chunk;
  };

  let unresolved: string[] = [];
  for (let i = 0; i < endpointIds.length; i += 10) {
    const leftover = await pullChunk(endpointIds.slice(i, i + 10));
    unresolved.push(...leftover);
    if (i > 0 && i % 80 === 0) await new Promise((r) => setTimeout(r, 250));
  }

  // Second pass: unresolved in batches of 5
  const still: string[] = [];
  for (let i = 0; i < unresolved.length; i += 5) {
    const leftover = await pullChunk(unresolved.slice(i, i + 5));
    still.push(...leftover);
  }

  // Final pass: up to 80 singles (avoid edge timeout)
  for (const id of still.slice(0, 80)) {
    const leftover = await pullChunk([id]);
    if (leftover.length) console.error("no price for", id);
  }

  console.log(`pricing resolved ${prices.size}/${endpointIds.length}`);
  return prices;
}

Deno.serve(async (req) => {
  const opt = handleOptions(req);
  if (opt) return opt;

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const falKey = Deno.env.get("FAL_KEY") ?? "";

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return err(req, "AUTH_REQUIRED", "Sign in required", 401);

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData } = await userClient.auth.getUser();
    if (!userData.user) return err(req, "AUTH_REQUIRED", "Sign in required", 401);

    const admin = createClient(supabaseUrl, serviceKey);
    const { data: profile } = await admin
      .from("profiles")
      .select("role")
      .eq("id", userData.user.id)
      .maybeSingle();
    const role = profile?.role;
    if (role !== "admin" && role !== "super_admin") {
      return err(req, "FORBIDDEN", "Admin only", 403);
    }

    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const activatePriced = Boolean(body.activate_priced);
    const marginPct = Number(body.margin_pct ?? DEFAULT_MARGIN_PCT);
    const fxUsdInr = Number(body.fx_usd_inr ?? DEFAULT_FX_USD_INR);
    const promoteToCatalog = body.promote_to_catalog !== false;

    if (!falKey) {
      return err(req, "FAL_KEY_MISSING", "FAL_KEY secret is not configured", 500);
    }

    const models = await fetchAllModels(falKey);
    // Price video endpoints first so they are less likely to hit rate limits
    const endpointIds = [
      ...models.filter((m) => mapFalCategoryToGenerationType(m.metadata?.category ?? "") === "video").map((m) => m.endpoint_id),
      ...models.filter((m) => mapFalCategoryToGenerationType(m.metadata?.category ?? "") !== "video").map((m) => m.endpoint_id),
    ];
    const priceMap = await fetchPricing(falKey, endpointIds);

    const inventoryRows = [];
    for (const m of models) {
      const category = m.metadata?.category ?? "unknown";
      const generationType = mapFalCategoryToGenerationType(category);
      if (!generationType) continue;
      const price = priceMap.get(m.endpoint_id);
      inventoryRows.push({
        endpoint_id: m.endpoint_id,
        display_name: m.metadata?.display_name ?? m.endpoint_id,
        category,
        generation_type: generationType,
        unit: price?.unit ?? null,
        unit_price_usd: price?.unit_price ?? null,
        currency: price?.currency ?? "USD",
        thumbnail_url: m.metadata?.thumbnail_url ?? null,
        status: m.metadata?.status ?? "active",
        description: m.metadata?.description ?? null,
        raw_metadata: m.metadata ?? {},
        fetched_at: new Date().toISOString(),
      });
    }

    // Upsert inventory in chunks
    let inventoryUpserted = 0;
    for (let i = 0; i < inventoryRows.length; i += 100) {
      const chunk = inventoryRows.slice(i, i + 100);
      const { error } = await admin.from("fal_model_inventory").upsert(chunk, {
        onConflict: "endpoint_id",
      });
      if (error) {
        console.error(error);
        return err(req, "INVENTORY_UPSERT_FAILED", error.message, 500);
      }
      inventoryUpserted += chunk.length;
    }

    let catalogUpserted = 0;
    let catalogActivated = 0;

    if (promoteToCatalog) {
      // Existing active map so we don't deactivate live models
      const { data: existing } = await admin
        .from("model_catalog")
        .select("id, provider_model_id, active, slug, configuration");
      const existingByEndpoint = new Map(
        (existing ?? []).map((r) => [r.provider_model_id as string, r]),
      );
      const usedSlugs = new Set((existing ?? []).map((r) => r.slug as string));

      const priced = inventoryRows
        .filter((r) => typeof r.unit_price_usd === "number" && r.unit_price_usd > 0)
        .filter((r) => normalizePricingUnit(r.unit) !== "compute_second")
        .sort((a, b) => (a.unit_price_usd ?? 0) - (b.unit_price_usd ?? 0));

      const catalogRows = [];
      let order = 1;
      for (const row of priced) {
        const prev = existingByEndpoint.get(row.endpoint_id);
        const prevCfg = (prev?.configuration ?? {}) as Record<string, unknown>;
        // Never overwrite the curated video lineup (names, credits, Hailuo overrides).
        if (prevCfg.curated === true) {
          continue;
        }

        const pricingUnit = normalizePricingUnit(row.unit);
        const minCredits =
          row.generation_type === "video"
            ? pricingUnit === "second"
              ? 1
              : 5
            : 1;
        const creditsPerUnit = falUsdToCredits(row.unit_price_usd as number, {
          fxUsdInr,
          marginPct,
          minCredits,
        });
        const creditCost =
          row.generation_type === "video" && pricingUnit === "second"
            ? Math.max(5, creditsPerUnit * DEFAULT_VIDEO_SECONDS)
            : Math.max(minCredits, creditsPerUnit);

        let slug = slugFromEndpointId(row.endpoint_id);
        if (prev) {
          slug = prev.slug as string;
        } else if (usedSlugs.has(slug)) {
          slug = `${slug}-${order}`;
        }
        usedSlugs.add(slug);

        // Videos stay inactive unless already live; images can still activate_priced.
        const shouldActivate =
          row.generation_type === "video"
            ? prev?.active === true
            : prev?.active === true || activatePriced;

        catalogRows.push({
          provider: "fal",
          provider_model_id: row.endpoint_id,
          friendly_name: row.display_name,
          slug,
          category: row.category,
          generation_type: row.generation_type,
          description: row.description,
          quality_tier: qualityTierFromUsd(row.unit_price_usd, row.generation_type),
          credit_cost: creditCost,
          credits_per_unit: creditsPerUnit,
          pricing_unit: pricingUnit,
          provider_pricing_unit: row.unit,
          estimated_provider_cost_usd: row.unit_price_usd,
          estimated_provider_cost_inr: Number(
            ((row.unit_price_usd as number) * fxUsdInr).toFixed(4),
          ),
          margin_pct: marginPct,
          fx_usd_inr: fxUsdInr,
          supports_image_input:
            row.category.includes("image-to") || row.category.includes("image_to"),
          supported_aspect_ratios:
            row.generation_type === "video"
              ? ["16:9", "9:16", "1:1"]
              : ["1:1", "4:5", "16:9", "9:16"],
          supported_durations:
            row.generation_type === "video" ? [5, 10, 15] : [],
          active: shouldActivate,
          display_order: order,
          configuration: {
            fal_category: row.category,
            thumbnail_url: row.thumbnail_url,
            synced_at: new Date().toISOString(),
          },
        });
        if (shouldActivate) catalogActivated += 1;
        order += 1;
      }

      for (let i = 0; i < catalogRows.length; i += 50) {
        const chunk = catalogRows.slice(i, i + 50);
        const { error } = await admin.from("model_catalog").upsert(chunk, {
          onConflict: "provider,provider_model_id",
        });
        if (error) {
          console.error(error);
          return err(req, "CATALOG_UPSERT_FAILED", error.message, 500);
        }
        catalogUpserted += chunk.length;
      }
    }

    const { data: matrix } = await admin
      .from("fal_model_inventory")
      .select(
        "endpoint_id, display_name, category, generation_type, unit, unit_price_usd, currency, status, fetched_at",
      )
      .order("unit_price_usd", { ascending: true, nullsFirst: false });

    return json(req, {
      ok: true,
      inventory_count: inventoryUpserted,
      catalog_upserted: catalogUpserted,
      catalog_activated: catalogActivated,
      margin_pct: marginPct,
      fx_usd_inr: fxUsdInr,
      matrix: matrix ?? [],
    });
  } catch (e) {
    console.error(e);
    return err(req, "INTERNAL_ERROR", e instanceof Error ? e.message : "Unexpected error", 500);
  }
});
