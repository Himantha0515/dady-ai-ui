import type {
  CreditGrant,
  CreditPack,
  CreditTransaction,
  ModelCatalogItem,
  Plan,
  Template,
} from "../../types/api";
import { invokeFunction, isSupabaseConfigured, mockBackend, supabase } from "../supabase/client";

const mockPlans: Plan[] = [
  {
    id: "plan-creator",
    slug: "creator",
    name: "Creator",
    description: "For individual creators",
    price_inr: 499,
    billing_interval: "month",
    included_credits: 700,
    credit_validity_days: 35,
    active: true,
    display_order: 1,
    metadata: {},
    razorpay_plan_id: null,
  },
  {
    id: "plan-studio",
    slug: "studio",
    name: "Studio",
    description: "For growing studios",
    price_inr: 999,
    billing_interval: "month",
    included_credits: 1600,
    credit_validity_days: 35,
    active: true,
    display_order: 2,
    metadata: {},
    razorpay_plan_id: null,
  },
  {
    id: "plan-agency",
    slug: "agency",
    name: "Agency",
    description: "For agencies & teams",
    price_inr: 2499,
    billing_interval: "month",
    included_credits: 5000,
    credit_validity_days: 35,
    active: true,
    display_order: 3,
    metadata: { cta: "Talk to us" },
    razorpay_plan_id: null,
  },
];

const mockPacks: CreditPack[] = [
  {
    id: "pack-mini",
    slug: "mini-99",
    name: "Mini Credit Pack",
    price_inr: 99,
    credits: 100,
    validity_days: 30,
    active: true,
    display_order: 1,
    metadata: {},
  },
];

const mockModels: ModelCatalogItem[] = [
  {
    id: "m-imagen-fast",
    provider: "fal",
    provider_model_id: "fal-ai/flux/schnell",
    friendly_name: "Imagen Fast",
    slug: "imagen-fast",
    category: "text-to-image",
    generation_type: "image",
    description: "Quick standard images",
    quality_tier: "fast",
    credit_cost: 2,
    credits_per_unit: 2,
    pricing_unit: "image",
    estimated_provider_cost_usd: 0.003,
    commercial_use_allowed: true,
    supports_image_input: false,
    supported_aspect_ratios: ["1:1", "4:5", "16:9", "9:16"],
    active: true,
    display_order: 1,
    configuration: {},
  },
  {
    id: "m-imagen-pro",
    provider: "fal",
    provider_model_id: "fal-ai/flux-pro",
    friendly_name: "Imagen Pro",
    slug: "imagen-pro",
    category: "text-to-image",
    generation_type: "image",
    description: "HD detail for campaigns",
    quality_tier: "hd",
    credit_cost: 5,
    credits_per_unit: 5,
    pricing_unit: "image",
    estimated_provider_cost_usd: 0.05,
    commercial_use_allowed: true,
    supports_image_input: true,
    supported_aspect_ratios: ["1:1", "4:5", "16:9", "9:16"],
    active: true,
    display_order: 2,
    configuration: {},
  },
  {
    id: "m-video-std",
    provider: "fal",
    provider_model_id: "fal-ai/minimax/video-01-live",
    friendly_name: "Video Standard",
    slug: "video-standard",
    category: "text-to-video",
    generation_type: "video",
    description: "Standard motion",
    quality_tier: "standard",
    credit_cost: 25,
    credits_per_unit: 5,
    pricing_unit: "second",
    estimated_provider_cost_usd: 0.05,
    commercial_use_allowed: true,
    supports_image_input: true,
    supported_aspect_ratios: ["16:9", "9:16"],
    supported_durations: [5, 10, 15],
    active: true,
    display_order: 10,
    configuration: {},
  },
  {
    id: "m-video-cin",
    provider: "fal",
    provider_model_id: "fal-ai/kling-video/v1.6/pro",
    friendly_name: "Cinematic Video",
    slug: "video-cinematic",
    category: "text-to-video",
    generation_type: "video",
    description: "Film-grade motion",
    quality_tier: "cinematic",
    credit_cost: 80,
    credits_per_unit: 16,
    pricing_unit: "second",
    estimated_provider_cost_usd: 0.1,
    commercial_use_allowed: true,
    supports_image_input: true,
    supported_aspect_ratios: ["16:9", "9:16"],
    supported_durations: [5, 10, 15],
    active: true,
    display_order: 11,
    configuration: {},
  },
];

export const catalogApi = {
  async listPlans(): Promise<Plan[]> {
    if (mockBackend) return mockPlans;
    const { data, error } = await supabase
      .from("plans")
      .select("*")
      .eq("active", true)
      .order("display_order");
    if (error) throw error;
    return data as Plan[];
  },

  async listCreditPacks(): Promise<CreditPack[]> {
    if (mockBackend) return mockPacks;
    const { data, error } = await supabase
      .from("credit_packs")
      .select("*")
      .eq("active", true)
      .order("display_order");
    if (error) throw error;
    return data as CreditPack[];
  },

  async listModels(generationType?: string): Promise<ModelCatalogItem[]> {
    if (mockBackend) {
      const list = generationType
        ? mockModels.filter((m) => m.generation_type === generationType)
        : mockModels;
      return [...list].sort(
        (a, b) =>
          (a.estimated_provider_cost_usd ?? a.credit_cost) -
          (b.estimated_provider_cost_usd ?? b.credit_cost),
      );
    }
    let q = supabase.from("model_catalog").select("*").eq("active", true);
    if (generationType) q = q.eq("generation_type", generationType);
    // Curated image + video lineups use display_order.
    if (generationType === "video" || generationType === "image") {
      q = q.order("display_order", { ascending: true }).order("credit_cost", {
        ascending: true,
      });
    } else {
      q = q
        .order("estimated_provider_cost_usd", { ascending: true, nullsFirst: false })
        .order("credit_cost", { ascending: true })
        .order("display_order");
    }
    const { data, error } = await q;
    if (error) throw error;
    return data as ModelCatalogItem[];
  },

  async listTemplates(): Promise<Template[]> {
    if (mockBackend) {
      return [
        {
          id: "t1",
          name: "Product Orbit",
          slug: "product-orbit",
          category: "ads",
          description: "Orbiting product hero",
          estimated_credit_cost: 5,
          active: true,
          featured: true,
        },
      ];
    }
    const { data, error } = await supabase
      .from("templates")
      .select("*")
      .eq("active", true)
      .order("trending_score", { ascending: false });
    if (error) throw error;
    return data as Template[];
  },

  async getPlatformStats(): Promise<{
    creators: number;
    generations: number;
    models: number;
    uptime_pct: number;
  }> {
    if (mockBackend || !isSupabaseConfigured) {
      return {
        creators: 0,
        generations: 0,
        models: mockModels.length,
        uptime_pct: 100,
      };
    }
    const { data, error } = await supabase.rpc("get_platform_stats");
    if (error) throw error;
    const row = (data ?? {}) as Record<string, unknown>;
    return {
      creators: Number(row.creators ?? 0),
      generations: Number(row.generations ?? 0),
      models: Number(row.models ?? 0),
      uptime_pct: Number(row.uptime_pct ?? 100),
    };
  },
};

export const paymentsApi = {
  async createOrder(creditPackId: string, idempotencyKey: string) {
    if (mockBackend || !isSupabaseConfigured) {
      return {
        orderId: `mock-order-${Date.now()}`,
        razorpayOrderId: `order_mock_${Date.now()}`,
        amountPaise: 9900,
        currency: "INR",
        keyId: import.meta.env.VITE_RAZORPAY_KEY_ID ?? "rzp_test_mock",
        mock: true,
      };
    }
    return invokeFunction("create-razorpay-order", {
      credit_pack_id: creditPackId,
      idempotency_key: idempotencyKey,
    });
  },

  async createSubscription(planId: string, idempotencyKey: string) {
    if (mockBackend || !isSupabaseConfigured) {
      return {
        subscriptionId: `mock-sub-${Date.now()}`,
        razorpaySubscriptionId: `sub_mock_${Date.now()}`,
        mock: true,
      };
    }
    return invokeFunction("create-razorpay-subscription", {
      plan_id: planId,
      idempotency_key: idempotencyKey,
    });
  },
};

export const generationsApi = {
  async submit(input: {
    project_id?: string;
    model_id: string;
    prompt: string;
    aspect_ratio?: string;
    resolution?: string;
    idempotency_key: string;
    input_configuration?: Record<string, unknown>;
  }) {
    if (mockBackend || !isSupabaseConfigured) {
      return {
        generation_id: `mock-gen-${Date.now()}`,
        application_status: "queued",
        credits_reserved: 5,
        mock: true,
      };
    }
    return invokeFunction("submit-generation", input);
  },

  async get(id: string) {
    if (mockBackend) {
      return {
        id,
        application_status: "completed",
        credits_reserved: 5,
        credits_charged: 5,
      };
    }
    const { data, error } = await supabase.from("generations").select("*").eq("id", id).single();
    if (error) throw error;
    return data;
  },

  /** Poll fal when webhooks are slow — unsticks “Generating…” jobs. */
  async syncStatus(
    generationId: string,
    opts?: { force_fail?: boolean; user_stop?: boolean },
  ) {
    if (mockBackend || !isSupabaseConfigured) {
      return {
        generation_id: generationId,
        application_status: opts?.user_stop ? "failed_refunded" : "completed",
        synced: false,
        failure_message: opts?.user_stop
          ? "Stopped. Credits refunded."
          : undefined,
      };
    }
    return invokeFunction("sync-generation-status", {
      generation_id: generationId,
      ...(opts?.force_fail ? { force_fail: true } : {}),
      ...(opts?.user_stop ? { user_stop: true } : {}),
    });
  },

  async listOutputs(generationId: string) {
    if (mockBackend) {
      return [
        {
          id: `mock-out-${generationId}`,
          generation_id: generationId,
          original_provider_url: "https://placehold.co/768x960/0e1d17/84cc16?text=Mock+Output",
          mime_type: "image/jpeg",
        },
      ];
    }
    const { data, error } = await supabase
      .from("generation_outputs")
      .select("id, generation_id, original_provider_url, mime_type, created_at")
      .eq("generation_id", generationId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data ?? [];
  },

  async listRecent(limit = 12, generationType?: "image" | "video") {
    if (mockBackend) return [];
    let q = supabase
      .from("generations")
      .select(
        "id, prompt, application_status, failure_message, generation_type, credits_charged, created_at, input_configuration, model_id, model_catalog(friendly_name, quality_tier), generation_outputs(id, original_provider_url, mime_type)",
      )
      .order("created_at", { ascending: false })
      .limit(limit);
    if (generationType) q = q.eq("generation_type", generationType);
    const { data, error } = await q;
    if (error) throw error;
    return data ?? [];
  },
};

function firstRel<T>(value: T | T[] | null | undefined): T | null {
  if (value == null) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
}

function normalizeCreditTx(row: Record<string, unknown>): CreditTransaction {
  const genRaw = firstRel(row.generations as Record<string, unknown> | Record<string, unknown>[] | null);
  const generations = genRaw
    ? {
        generation_type: (genRaw.generation_type as string | null) ?? null,
        prompt: (genRaw.prompt as string | null) ?? null,
        application_status: (genRaw.application_status as string | null) ?? null,
        model_catalog: firstRel(
          genRaw.model_catalog as
            | { friendly_name: string | null }
            | { friendly_name: string | null }[]
            | null,
        ),
        projects: firstRel(
          genRaw.projects as { name: string | null } | { name: string | null }[] | null,
        ),
      }
    : null;

  return {
    id: String(row.id),
    user_id: String(row.user_id),
    transaction_type: row.transaction_type as CreditTransaction["transaction_type"],
    credits: Number(row.credits),
    balance_before: Number(row.balance_before),
    balance_after: Number(row.balance_after),
    source_type: (row.source_type as string | null) ?? null,
    source_id: (row.source_id as string | null) ?? null,
    generation_id: (row.generation_id as string | null) ?? null,
    order_id: (row.order_id as string | null) ?? null,
    description: (row.description as string | null) ?? null,
    created_at: String(row.created_at),
    generations,
  };
}

export const walletApi = {
  async listTransactions(limit = 40): Promise<CreditTransaction[]> {
    if (mockBackend || !isSupabaseConfigured) return [];
    const nested = await supabase
      .from("credit_transactions")
      .select(
        "id, user_id, transaction_type, credits, balance_before, balance_after, source_type, source_id, generation_id, order_id, description, created_at, generations(generation_type, prompt, application_status, model_catalog(friendly_name), projects(name))",
      )
      .order("created_at", { ascending: false })
      .limit(limit);
    if (!nested.error) {
      return ((nested.data ?? []) as Record<string, unknown>[]).map(normalizeCreditTx);
    }

    // Fallback if embed relationships are unavailable
    const { data, error } = await supabase
      .from("credit_transactions")
      .select(
        "id, user_id, transaction_type, credits, balance_before, balance_after, source_type, source_id, generation_id, order_id, description, created_at",
      )
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) throw error;
    return ((data ?? []) as Record<string, unknown>[]).map(normalizeCreditTx);
  },

  async listGrants(): Promise<CreditGrant[]> {
    if (mockBackend || !isSupabaseConfigured) return [];
    const { data, error } = await supabase
      .from("credit_grants")
      .select(
        "id, user_id, source_type, source_id, credits_total, credits_remaining, expires_at, status, created_at",
      )
      .eq("status", "active")
      .gt("credits_remaining", 0)
      .order("expires_at", { ascending: true });
    if (error) throw error;
    return (data ?? []) as CreditGrant[];
  },

  async getActiveSubscription(): Promise<{
    current_period_end: string | null;
    plan: { name: string; included_credits: number } | null;
  } | null> {
    if (mockBackend || !isSupabaseConfigured) return null;
    const { data, error } = await supabase
      .from("subscriptions")
      .select("current_period_end, plans(name, included_credits)")
      .in("status", ["active", "authenticated", "paused", "past_due"])
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    const plans = data.plans as
      | { name: string; included_credits: number }
      | { name: string; included_credits: number }[]
      | null;
    const plan = Array.isArray(plans) ? plans[0] ?? null : plans;
    return {
      current_period_end: data.current_period_end as string | null,
      plan,
    };
  },
};

export type WishlistItem = {
  id: string;
  image_url: string;
  prompt: string | null;
  aspect_ratio: string | null;
  quality: string | null;
  model_name: string | null;
  model_id: string | null;
  generation_id: string | null;
  output_id: string | null;
  settings: Record<string, unknown>;
  created_at: string;
};

export const wishlistApi = {
  async list(): Promise<WishlistItem[]> {
    if (mockBackend || !isSupabaseConfigured) return [];
    const { data, error } = await supabase
      .from("wishlists")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []) as WishlistItem[];
  },

  async add(item: {
    image_url: string;
    prompt?: string | null;
    aspect_ratio?: string | null;
    quality?: string | null;
    model_name?: string | null;
    model_id?: string | null;
    generation_id?: string | null;
    output_id?: string | null;
    settings?: Record<string, unknown>;
  }) {
    if (mockBackend || !isSupabaseConfigured) {
      return { id: `wish-${Date.now()}`, ...item, created_at: new Date().toISOString() };
    }
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) throw new Error("Sign in required");
    const { data, error } = await supabase
      .from("wishlists")
      .upsert(
        {
          user_id: userData.user.id,
          image_url: item.image_url,
          prompt: item.prompt ?? null,
          aspect_ratio: item.aspect_ratio ?? null,
          quality: item.quality ?? null,
          model_name: item.model_name ?? null,
          model_id: item.model_id ?? null,
          generation_id: item.generation_id ?? null,
          output_id: item.output_id ?? null,
          settings: item.settings ?? {},
        },
        { onConflict: "user_id,image_url" },
      )
      .select("*")
      .single();
    if (error) throw error;
    return data as WishlistItem;
  },

  async remove(id: string) {
    if (mockBackend || !isSupabaseConfigured) return;
    const { error } = await supabase.from("wishlists").delete().eq("id", id);
    if (error) throw error;
  },

  async removeByImageUrl(imageUrl: string) {
    if (mockBackend || !isSupabaseConfigured) return;
    const { error } = await supabase.from("wishlists").delete().eq("image_url", imageUrl);
    if (error) throw error;
  },
};

export async function uploadReferenceImage(file: File): Promise<string> {
  if (mockBackend || !isSupabaseConfigured) {
    return URL.createObjectURL(file);
  }
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) throw new Error("Sign in required");
  const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const path = `${userData.user.id}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from("references").upload(path, file, {
    cacheControl: "3600",
    upsert: false,
    contentType: file.type || "image/jpeg",
  });
  if (error) throw error;
  const { data } = supabase.storage.from("references").getPublicUrl(path);
  return data.publicUrl;
}
