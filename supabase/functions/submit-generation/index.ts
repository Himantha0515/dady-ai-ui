import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.8";
import { handleOptions } from "../_shared/cors.ts";
import { err, json } from "../_shared/http.ts";
import {
  estimateJobCredits,
  normalizeResolutionKey,
} from "../_shared/credits.ts";

function durationSecondsFromConfig(cfg: Record<string, unknown>, fallback = 5): number {
  const raw = cfg.duration_seconds ?? cfg.duration ?? cfg.seconds;
  if (typeof raw === "number" && Number.isFinite(raw) && raw > 0) return Math.round(raw);
  if (typeof raw === "string") {
    const n = Number.parseInt(raw, 10);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return fallback;
}

function collectReferenceUrls(cfg: Record<string, unknown>): string[] {
  const urls: string[] = [];
  if (typeof cfg.reference_image_url === "string" && cfg.reference_image_url) {
    urls.push(cfg.reference_image_url);
  }
  if (Array.isArray(cfg.reference_image_urls)) {
    for (const u of cfg.reference_image_urls) {
      if (typeof u === "string" && u && !urls.includes(u)) urls.push(u);
    }
  }
  return urls;
}

/** Map UI duration to provider-friendly values (Hailuo supports 6 | 10). */
function falVideoDuration(modelPath: string, seconds: number): string | number {
  const path = modelPath.toLowerCase();
  if (path.includes("minimax/hailuo")) {
    return seconds >= 10 ? "10" : "6";
  }
  // Veo expects "4s" | "6s" | "8s"
  if (path.includes("veo")) {
    if (seconds <= 4) return "4s";
    if (seconds <= 6) return "6s";
    return "8s";
  }
  // Luma Ray expects "5s" | "10s" (with the s suffix)
  if (path.includes("luma") || path.includes("ray")) {
    return seconds >= 10 ? "10s" : "5s";
  }
  // Sora expects numeric 4 | 8 | 12 | 16 | 20 (not strings, not 5)
  if (path.includes("sora")) {
    const opts = [4, 8, 12, 16, 20];
    return opts.reduce((best, n) =>
      Math.abs(n - seconds) < Math.abs(best - seconds) ? n : best
    , opts[0]);
  }
  if (seconds <= 5) return "5";
  if (seconds <= 10) return "10";
  return "15";
}

/** Fal queue status base path — not always the model endpoint root. */
function falQueueBasePath(modelPath: string): string {
  const path = modelPath.replace(/\/+$/, "");
  // Luma agent queue lives at luma/agent (see fal status_url), not .../ray/v3.2
  if (path.startsWith("luma/agent/")) return "luma/agent";
  if (path.includes("longcat-video")) return "fal-ai/longcat-video";
  return path
    .replace(/\/text-to-video\/[^/]+$/i, "")
    .replace(/\/text-to-video$/i, "")
    .replace(/\/image-to-video$/i, "")
    .replace(/\/+$/, "");
}

/** Fal resolution enum values (never 4K — not launched). */
function toFalResolution(resolution: string): "480p" | "720p" | "1080p" {
  const key = normalizeResolutionKey(resolution);
  if (key === "1080p") return "1080p";
  if (key === "480p") return "480p";
  return "720p";
}

/** Models that accept fal `resolution` enum ("720p" | "1080p"). */
function videoSupportsResolutionParam(modelPath: string): boolean {
  const p = modelPath.toLowerCase();
  // Hailuo uses 512P/768P strings; LongCat quality is path-encoded.
  if (p.includes("hailuo") || p.includes("minimax")) return false;
  if (p.includes("longcat")) return false;
  return true;
}

function resolveVideoPathForResolution(modelPath: string, resolution: string): string {
  const key = normalizeResolutionKey(resolution);
  if (!modelPath.toLowerCase().includes("longcat")) return modelPath;
  if (key === "1080p" && modelPath.includes("/720p")) {
    return modelPath.replace("/720p", "/1080p");
  }
  if (key === "720p" && modelPath.includes("/1080p")) {
    return modelPath.replace("/1080p", "/720p");
  }
  return modelPath;
}

function applyHailuoResolution(
  falBody: Record<string, unknown>,
  resolution: string,
  inputDefaults: Record<string, unknown>,
) {
  const key = normalizeResolutionKey(resolution);
  // Best available Hailuo tier for "1080p" UI choice is 768P.
  if (key === "1080p") {
    falBody.resolution = "768P";
    return;
  }
  if (typeof inputDefaults.resolution === "string") {
    falBody.resolution = inputDefaults.resolution;
  } else {
    falBody.resolution = "512P";
  }
}

function videoSupportsAspectRatioParam(modelPath: string): boolean {
  const p = modelPath.toLowerCase();
  if (p.includes("hailuo") || p.includes("minimax")) return false;
  return true;
}

function resolveFalVideoPath(modelPath: string, hasReference: boolean): string {
  // Kling 2.1 Standard has no text-to-video on fal (I2V only). Use Master for T2V.
  if (modelPath.includes("kling-video/v2.1/standard")) {
    if (hasReference) {
      return modelPath.includes("/image-to-video")
        ? modelPath
        : "fal-ai/kling-video/v2.1/standard/image-to-video";
    }
    return "fal-ai/kling-video/v2.1/master/text-to-video";
  }
  if (!hasReference) return modelPath;
  if (modelPath.includes("/text-to-video")) {
    return modelPath.replace("/text-to-video", "/image-to-video");
  }
  return modelPath;
}

function normalizeAspectForModel(modelPath: string, aspectRatio: string): string {
  const path = modelPath.toLowerCase();
  // Sora / Veo only support 9:16 and 16:9
  if ((path.includes("sora") || path.includes("veo")) && aspectRatio === "1:1") {
    return "9:16";
  }
  return aspectRatio;
}

/** Prefer FINAL_VIDEO_PROMPT block when a long STYLE_LOCK template exceeds provider limits. */
function compactPromptForProvider(prompt: string, maxChars: number): string {
  if (prompt.length <= maxChars) return prompt;
  const match = prompt.match(/FINAL_VIDEO_PROMPT\s*=\s*"""([\s\S]*?)"""/i);
  const finalBlock = match?.[1]?.trim();
  if (finalBlock && finalBlock.length <= maxChars) return finalBlock;
  const match2 = prompt.match(/FINAL_VIDEO_PROMPT\s*=\s*"([\s\S]*?)"/i);
  const finalBlock2 = match2?.[1]?.trim();
  if (finalBlock2 && finalBlock2.length <= maxChars) return finalBlock2;
  return prompt.slice(0, maxChars);
}

function maxPromptCharsForModel(modelPath: string, generationType: string): number {
  if (modelPath.includes("minimax/hailuo") || modelPath.includes("hailuo")) return 2000;
  if (generationType === "video") return 2500;
  return 4000;
}

Deno.serve(async (req) => {
  const opt = handleOptions(req);
  if (opt) return opt;

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const falKey = Deno.env.get("FAL_KEY") ?? "";
    const mock = Deno.env.get("MOCK_PROVIDERS") === "true" || !falKey;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return err(req, "AUTH_REQUIRED", "Sign in required", 401);

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData } = await userClient.auth.getUser();
    if (!userData.user) return err(req, "AUTH_REQUIRED", "Sign in required", 401);

    const body = await req.json();
    const modelId = body.model_id as string;
    const promptRaw = body.prompt;
    const prompt = typeof promptRaw === "string" ? promptRaw.trim() : "";
    const idempotencyKey = body.idempotency_key as string;
    const projectId = body.project_id as string | undefined;
    const inputCfg = (body.input_configuration ?? {}) as Record<string, unknown>;
    const aspectRatio = String(
      body.aspect_ratio ?? inputCfg.aspect_ratio ?? "9:16",
    ).trim();
    const numImages = Math.max(1, Number(inputCfg.outputs ?? inputCfg.num_images ?? 1) || 1);
    const durationSeconds = durationSecondsFromConfig(inputCfg, 5);
    const resolutionRaw =
      typeof inputCfg.resolution === "string"
        ? inputCfg.resolution
        : typeof body.resolution === "string"
          ? body.resolution
          : "720p";
    const resolution = normalizeResolutionKey(resolutionRaw);

    // 4K is not launched — never charge or submit 4K jobs.
    if (resolution === "4K") {
      return err(req, 
        "MODEL_CONFIGURATION_INVALID",
        "4K is launching soon. Please choose 720p or 1080p.",
      );
    }

    if (!modelId || !prompt || !idempotencyKey) {
      return err(req, "INVALID_INPUT", "model_id, prompt and idempotency_key are required");
    }
    // Soft ceiling for abuse; provider-specific limits are enforced above.
    const MAX_PROMPT_CHARS = 12000;
    if (prompt.length > MAX_PROMPT_CHARS) {
      return err(req, 
        "INVALID_INPUT",
        `Prompt is too long (${prompt.length.toLocaleString()}/${MAX_PROMPT_CHARS.toLocaleString()} characters). Shorten it and try again.`,
      );
    }

    const admin = createClient(supabaseUrl, serviceKey);

    const { data: existing } = await admin
      .from("generations")
      .select("*")
      .eq("idempotency_key", idempotencyKey)
      .maybeSingle();
    if (existing) {
      return json(req, {
        generation_id: existing.id,
        application_status: existing.application_status,
        credits_reserved: existing.credits_reserved,
        deduped: true,
      });
    }

    const { data: model } = await admin
      .from("model_catalog")
      .select("*")
      .eq("id", modelId)
      .eq("active", true)
      .single();
    if (!model) return err(req, "MODEL_UNAVAILABLE", "Selected model is unavailable");

    const cfgJsonEarly = (model.configuration ?? {}) as Record<string, unknown>;
    const falEndpointEarly =
      typeof cfgJsonEarly.fal_endpoint === "string"
        ? cfgJsonEarly.fal_endpoint
        : (model.provider_model_id as string);
    const referenceUrlsEarly = collectReferenceUrls(inputCfg);
    const resolvedPathEarly = resolveFalVideoPath(
      falEndpointEarly,
      Boolean(referenceUrlsEarly[0]) && model.generation_type === "video",
    );
    const maxPromptChars = maxPromptCharsForModel(
      resolvedPathEarly,
      model.generation_type as string,
    );
    const promptForProvider = compactPromptForProvider(prompt, maxPromptChars);
    if (promptForProvider.length > maxPromptChars) {
      return err(req, 
        "INVALID_INPUT",
        `Prompt is too long for ${model.friendly_name} (${prompt.length.toLocaleString()}/${maxPromptChars.toLocaleString()} max). Shorten it, or keep a FINAL_VIDEO_PROMPT block under the limit.`,
      );
    }

    const allowedRatios: string[] = model.supported_aspect_ratios ?? [];
    if (allowedRatios.length && !allowedRatios.includes(aspectRatio)) {
      return err(req, "MODEL_CONFIGURATION_INVALID", `Aspect ratio ${aspectRatio} is not supported`);
    }

    const creditCost = estimateJobCredits(
      {
        generation_type: model.generation_type,
        credit_cost: model.credit_cost,
        credits_per_unit: model.credits_per_unit,
        pricing_unit: model.pricing_unit ?? model.provider_pricing_unit,
        estimated_provider_cost_usd: model.estimated_provider_cost_usd,
        margin_pct: model.margin_pct,
        fx_usd_inr: model.fx_usd_inr,
        configuration: (model.configuration ?? {}) as Record<string, unknown>,
      },
      {
        durationSeconds,
        numImages,
        resolution,
      },
    );

    const cfgForPrice = (model.configuration ?? {}) as Record<string, unknown>;
    const priceByRes = cfgForPrice.price_usd_by_resolution as
      | Record<string, number>
      | undefined;
    const providerUnitCost = Number(
      (priceByRes && (priceByRes[resolution] ?? priceByRes["720p"])) ??
        model.estimated_provider_cost_usd ??
        0,
    );
    const estimatedProviderCostUsd =
      model.generation_type === "video" &&
        !String(model.pricing_unit ?? "").includes("video")
        ? providerUnitCost * durationSeconds
        : providerUnitCost * numImages;

    const { data: generation, error: genErr } = await admin
      .from("generations")
      .insert({
        user_id: userData.user.id,
        project_id: projectId ?? null,
        model_id: modelId,
        generation_type: model.generation_type,
        prompt,
        application_status: "validating",
        input_configuration: {
          aspect_ratio: aspectRatio,
          duration_seconds: durationSeconds,
          outputs: numImages,
          ...inputCfg,
          ...(promptForProvider !== prompt
            ? {
              prompt_compacted: true,
              original_prompt_length: prompt.length,
              provider_prompt_length: promptForProvider.length,
            }
            : {}),
        },
        estimated_provider_cost_usd: estimatedProviderCostUsd || null,
        idempotency_key: idempotencyKey,
      })
      .select("*")
      .single();

    if (genErr || !generation) {
      console.error(genErr);
      return err(req, "INTERNAL_ERROR", "Could not create generation", 500);
    }

    const { data: reserve, error: reserveErr } = await admin.rpc("reserve_generation_credits", {
      p_generation_id: generation.id,
      p_model_id: modelId,
      p_idempotency_key: `reserve:${idempotencyKey}`,
      p_credits: creditCost,
    });

    if (reserveErr) {
      const { data: wallet } = await admin
        .from("wallets")
        .select("*")
        .eq("user_id", userData.user.id)
        .single();

      if (!wallet || wallet.available_credits < creditCost) {
        await admin.from("generations").update({ application_status: "failed" }).eq("id", generation.id);
        return err(req, 
          "INSUFFICIENT_CREDITS",
          `You need ${creditCost} credits, but your current balance is ${wallet?.available_credits ?? 0}.`,
          402,
        );
      }

      const { data: grants } = await admin
        .from("credit_grants")
        .select("*")
        .eq("user_id", userData.user.id)
        .eq("status", "active")
        .gt("credits_remaining", 0)
        .order("expires_at", { ascending: true, nullsFirst: false });

      let needed = creditCost;
      for (const g of grants ?? []) {
        if (needed <= 0) break;
        const take = Math.min(g.credits_remaining, needed);
        await admin
          .from("credit_grants")
          .update({
            credits_remaining: g.credits_remaining - take,
            status: g.credits_remaining - take === 0 ? "exhausted" : "active",
          })
          .eq("id", g.id);
        await admin.from("generation_credit_allocations").insert({
          generation_id: generation.id,
          credit_grant_id: g.id,
          credits_reserved: take,
        });
        needed -= take;
      }

      if (needed > 0) {
        return err(req, "INSUFFICIENT_CREDITS", `You need ${creditCost} credits.`, 402);
      }

      await admin
        .from("wallets")
        .update({
          available_credits: wallet.available_credits - creditCost,
          reserved_credits: wallet.reserved_credits + creditCost,
        })
        .eq("user_id", userData.user.id);

      await admin.from("credit_transactions").insert({
        user_id: userData.user.id,
        transaction_type: "GENERATION_RESERVE",
        credits: -creditCost,
        balance_before: wallet.available_credits,
        balance_after: wallet.available_credits - creditCost,
        generation_id: generation.id,
        description: "Reserve credits for generation",
        idempotency_key: `reserve:${idempotencyKey}`,
      });

      await admin
        .from("generations")
        .update({
          credits_reserved: creditCost,
          application_status: "queued",
          started_at: new Date().toISOString(),
        })
        .eq("id", generation.id);
    }

    let providerRequestId = `mock_${generation.id}`;

    if (!mock) {
      const webhookUrl = `${supabaseUrl}/functions/v1/fal-webhook`;
      const referenceUrls = collectReferenceUrls(inputCfg);
      const referenceUrl = referenceUrls[0] ?? null;
      const cfgJson = (model.configuration ?? {}) as Record<string, unknown>;
      const falEndpointOverride =
        typeof cfgJson.fal_endpoint === "string" ? cfgJson.fal_endpoint : null;
      const inputDefaults =
        cfgJson.input_defaults && typeof cfgJson.input_defaults === "object"
          ? (cfgJson.input_defaults as Record<string, unknown>)
          : {};
      let modelPath = falEndpointOverride || (model.provider_model_id as string);
      if (model.generation_type === "video") {
        modelPath = resolveFalVideoPath(modelPath, Boolean(referenceUrl));
        modelPath = resolveVideoPathForResolution(modelPath, resolution);
      }
      const falEndpoint =
        `https://queue.fal.run/${modelPath}?fal_webhook=${encodeURIComponent(webhookUrl)}`;

      let falBody: Record<string, unknown>;

      if (model.generation_type === "video") {
        falBody = {
          ...inputDefaults,
          prompt: promptForProvider,
        };

        // User selection always wins over catalog defaults (except Hailuo fixed res).
        falBody.duration = falVideoDuration(modelPath, durationSeconds);

        if (videoSupportsAspectRatioParam(modelPath)) {
          falBody.aspect_ratio = normalizeAspectForModel(modelPath, aspectRatio);
        } else {
          delete falBody.aspect_ratio;
        }

        const isHailuo = /hailuo|minimax/i.test(modelPath);
        if (isHailuo) {
          applyHailuoResolution(falBody, resolution, inputDefaults);
        } else if (videoSupportsResolutionParam(modelPath)) {
          // Exact fal enum: "720p" | "1080p" (never "4K" / "4k")
          falBody.resolution = toFalResolution(resolution);
        }

        if (referenceUrl) falBody.image_url = referenceUrl;
        if (referenceUrls[1]) falBody.end_image_url = referenceUrls[1];
        if (referenceUrls.length > 2) falBody.image_urls = referenceUrls;

        console.log("fal video submit", {
          modelPath,
          aspect_ratio: falBody.aspect_ratio ?? null,
          resolution: falBody.resolution ?? null,
          duration: falBody.duration ?? null,
        });
      } else {
        const aspectToFalSize: Record<string, string> = {
          "1:1": "square_hd",
          "4:5": "portrait_4_3",
          "3:4": "portrait_4_3",
          "9:16": "portrait_16_9",
          "16:9": "landscape_16_9",
          "4:3": "landscape_4_3",
          "3:2": "landscape_4_3",
        };
        const imageSize = aspectToFalSize[aspectRatio] ?? "portrait_4_3";
        const useImg2Img = Boolean(referenceUrl && model.supports_image_input);
        falBody = useImg2Img
          ? {
            prompt: promptForProvider,
            image_url: referenceUrl,
            image_size: imageSize,
            num_images: numImages,
            output_format: "jpeg",
            strength: 0.85,
          }
          : {
            prompt: promptForProvider,
            image_size: imageSize,
            num_images: numImages,
            output_format: "jpeg",
          };
      }

      const falRes = await fetch(falEndpoint, {
        method: "POST",
        headers: {
          Authorization: `Key ${falKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(falBody),
      });

      if (!falRes.ok) {
        const falErrText = await falRes.text();
        console.error("fal submit failed", modelPath, falErrText);
        const shortMsg = falErrText.slice(0, 280) || "Provider rejected the job";
        const { error: releaseErr } = await admin.rpc("release_generation_credits", {
          p_generation_id: generation.id,
          p_idempotency_key: `release-submit-fail:${idempotencyKey}`,
          p_status: "failed_refunded",
        });
        if (releaseErr) console.error("release_generation_credits failed", releaseErr);
        await admin.from("generations").update({
          application_status: "failed",
          failure_message: shortMsg,
        }).eq("id", generation.id);
        return err(req, "GENERATION_SUBMISSION_FAILED", shortMsg, 502);
      }
      const falJson = await falRes.json() as Record<string, unknown>;
      providerRequestId = String(falJson.request_id ?? falJson.id ?? providerRequestId);
      // Persist fal queue URLs so sync uses the correct base (critical for Luma agent).
      const statusUrl = typeof falJson.status_url === "string" ? falJson.status_url : null;
      const cancelUrl =
        typeof falJson.cancel_url === "string"
          ? falJson.cancel_url
          : statusUrl
          ? statusUrl.replace(/\/status\/?$/, "/cancel")
          : null;
      if (statusUrl || cancelUrl) {
        await admin.from("generations").update({
          input_configuration: {
            ...((generation.input_configuration ?? {}) as Record<string, unknown>),
            fal_status_url: statusUrl,
            fal_response_url:
              typeof falJson.response_url === "string" ? falJson.response_url : null,
            fal_cancel_url: cancelUrl,
            fal_queue_base: falQueueBasePath(modelPath),
          },
        }).eq("id", generation.id);
      }
    }

    await admin
      .from("generations")
      .update({
        provider_request_id: providerRequestId,
        provider_status: mock ? "MOCK_QUEUED" : "IN_QUEUE",
        application_status: "generating",
        credits_reserved: creditCost,
      })
      .eq("id", generation.id);

    if (mock) {
      await admin.from("generation_outputs").insert({
        generation_id: generation.id,
        user_id: userData.user.id,
        output_type: model.generation_type,
        storage_provider: "supabase",
        storage_bucket: "outputs",
        storage_key: `outputs/${userData.user.id}/${generation.id}/mock.webp`,
        mime_type: model.generation_type === "video" ? "video/mp4" : "image/webp",
        metadata: { mock: true },
      });

      const { data: w2 } = await admin.from("wallets").select("*").eq("user_id", userData.user.id).single();
      if (w2) {
        await admin
          .from("wallets")
          .update({
            reserved_credits: Math.max(0, w2.reserved_credits - creditCost),
            lifetime_used: w2.lifetime_used + creditCost,
          })
          .eq("user_id", userData.user.id);
      }
      await admin
        .from("generations")
        .update({
          application_status: "completed",
          credits_charged: creditCost,
          completed_at: new Date().toISOString(),
        })
        .eq("id", generation.id);
    }

    return json(req, {
      generation_id: generation.id,
      application_status: mock ? "completed" : "generating",
      credits_reserved: creditCost,
      mock,
      reserve,
    });
  } catch (e) {
    console.error(e);
    return err(req, "INTERNAL_ERROR", "Unexpected error", 500);
  }
});
