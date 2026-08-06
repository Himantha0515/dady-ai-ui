import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { TopNav } from "../layouts/TopNav";
import { MobileBottomNav } from "../layouts/MobileBottomNav";
import { AutoPlayVideo } from "../components/AutoPlayVideo";
import { Button, Placeholder, Progress, Segment } from "../components/ui";
import { useModels, useWallet } from "../hooks/useCatalog";
import { estimateJobCredits, formatModelPriceLabel } from "../lib/pricing/credits";
import {
  generationsApi,
  uploadReferenceImage,
  wishlistApi,
  type WishlistItem,
} from "../lib/api/catalog";
import {
  compactPromptForProvider,
  maxPromptCharsForVideoModel,
} from "../lib/prompts/compact";
import { isFeaturedVideoModel, isRecommendedVideoModel } from "../lib/models/recommendedVideoModels";
import { videoStudioTemplates } from "../lib/studioTemplates";
import { isWishlistVideo } from "../lib/wishlistMedia";
import "./CreateStudio.css";

const MAX_REFERENCE_IMAGES = 8;
const MAX_REFERENCE_BYTES = 10 * 1024 * 1024;
const ACCEPTED_IMAGE_TYPES = ["image/png", "image/jpeg", "image/jpg", "image/webp"];

type VideoLaunchState = {
  prompt?: string;
  modelName?: string;
  duration?: string;
  ratio?: string;
};

type ReferenceItem = {
  id: string;
  file: File;
  preview: string;
};

type ResultShot = {
  id: string;
  outputId?: string;
  generationId?: string;
  url: string | null;
  label: string;
  status: string;
  prompt?: string | null;
  aspectRatio?: string | null;
  duration?: string | null;
  modelName?: string | null;
  modelId?: string | null;
  mimeType?: string | null;
  /** Estimated 0–100 while generating (fal does not send a real %). */
  progressPct?: number;
};

/** After this, offer Stop (cancel fal if unfinished + refund). Auto-wait continues. */
const GENERATION_SOFT_TIMEOUT_MS = 3 * 60 * 1000;
/** Only then mark failed if fal still has no video. Never auto-restarts. */
const GENERATION_HARD_TIMEOUT_MS = 12 * 60 * 1000;

function estimateProgressPct(
  elapsedMs: number,
  providerStatus?: string | null,
  appStatus?: string,
): number {
  if (appStatus === "completed") return 100;
  if (appStatus === "failed" || appStatus === "failed_refunded") return 0;
  const t = Math.min(1, Math.max(0, elapsedMs / GENERATION_HARD_TIMEOUT_MS));
  const p = (providerStatus || "").toUpperCase();
  if (p === "IN_QUEUE" || appStatus === "queued" || appStatus === "validating") {
    // Queue phase: climb to ~40%
    return Math.max(4, Math.min(40, Math.round(4 + t * 36)));
  }
  if (p === "IN_PROGRESS" || appStatus === "generating") {
    // Active generation: 40% → 94%
    return Math.max(40, Math.min(94, Math.round(40 + t * 54)));
  }
  return Math.max(3, Math.min(90, Math.round(t * 90)));
}

function durationOptionsForModel(model?: {
  provider_model_id?: string;
  configuration?: unknown;
  supported_durations?: number[] | null;
} | null): string[] {
  const cfg = (model?.configuration ?? {}) as Record<string, unknown>;
  const path = String(cfg.fal_endpoint || model?.provider_model_id || "").toLowerCase();
  if (path.includes("sora")) return ["4s", "8s", "12s"];
  if (path.includes("veo")) return ["4s", "6s", "8s"];
  if (path.includes("luma") || path.includes("ray")) return ["5s", "10s"];
  if (path.includes("longcat")) return ["5s", "10s"];
  if (path.includes("hailuo") || path.includes("minimax")) return ["6s", "10s"];
  if (model?.supported_durations?.length) {
    return model.supported_durations.map((n) => `${n}s`);
  }
  return ["5s", "10s", "15s"];
}

function parseDurationSeconds(duration: string) {
  const n = Number.parseInt(duration, 10);
  return Number.isFinite(n) && n > 0 ? n : 5;
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function downloadMedia(url: string, filename: string) {
  try {
    const res = await fetch(url, { mode: "cors" });
    if (!res.ok) throw new Error("fetch failed");
    const blob = await res.blob();
    const objectUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = objectUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(objectUrl);
  } catch {
    const a = document.createElement("a");
    a.href = url;
    a.target = "_blank";
    a.rel = "noreferrer";
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }
}

export function VideoStudio() {
  const location = useLocation();
  const nav = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);
  /** Set when user hits Stop — poll loop exits without force-fail. */
  const stopRequestedRef = useRef(false);
  const { credits, refreshWallet } = useWallet();
  const { data: catalog = [] } = useModels("video");
  const launch = (location.state as VideoLaunchState | null) ?? null;
  const [modelId, setModelId] = useState<string | null>(null);
  const [duration, setDuration] = useState(launch?.duration || "5s");
  const [ratio, setRatio] = useState(launch?.ratio || "9:16");
  const [res, setRes] = useState("720p");
  const [picker, setPicker] = useState(false);
  const [search, setSearch] = useState("");
  const [references, setReferences] = useState<ReferenceItem[]>([]);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [mainTab, setMainTab] = useState<"create" | "wishlist">("create");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<ResultShot[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeGenId, setActiveGenId] = useState<string | null>(null);
  /** Stop appears after 3 minutes while still generating. */
  const [canStop, setCanStop] = useState(false);
  const [stopping, setStopping] = useState(false);
  /** Avoid flashing fake template cards while real history loads. */
  const [historyLoading, setHistoryLoading] = useState(true);
  const [wishlist, setWishlist] = useState<WishlistItem[]>([]);
  const [wishBusy, setWishBusy] = useState(false);
  const [prompt, setPrompt] = useState(
    launch?.prompt ||
      "Slow push in on the mug, steam rising, warm morning light through a window",
  );

  const selected = useMemo(() => {
    if (modelId) return catalog.find((m) => m.id === modelId) ?? catalog[0];
    if (launch?.modelName) {
      return (
        catalog.find((m) => m.friendly_name === launch.modelName) ?? catalog[0]
      );
    }
    return catalog[0];
  }, [catalog, modelId, launch?.modelName]);

  const secs = parseDurationSeconds(duration);
  const creditCost = selected
    ? estimateJobCredits(selected, { durationSeconds: secs, resolution: res })
    : 0;
  const maxPromptChars = maxPromptCharsForVideoModel(selected);
  const promptOverLimit = prompt.length > maxPromptChars;

  const aspectOptions = useMemo(() => {
    const cfg = (selected?.configuration ?? {}) as Record<string, unknown>;
    const path = String(cfg.fal_endpoint || selected?.provider_model_id || "").toLowerCase();
    // Sora / Veo only support 16:9 and 9:16
    if (path.includes("sora") || path.includes("veo")) return ["16:9", "9:16"];
    const fromModel = selected?.supported_aspect_ratios?.filter(Boolean) ?? [];
    return fromModel.length ? fromModel : ["16:9", "9:16", "1:1"];
  }, [selected?.supported_aspect_ratios, selected?.configuration, selected?.provider_model_id]);

  const durationOptions = useMemo(
    () => durationOptionsForModel(selected),
    [selected],
  );

  const inFlight = useMemo(
    () =>
      results.some(
        (r) =>
          r.status === "generating" ||
          r.status === "queued" ||
          r.status === "validating",
      ),
    [results],
  );

  // 4K not launched; keep resolution + aspect + duration aligned with selectable options.
  useEffect(() => {
    if (res === "4K" || res === "4k") setRes("720p");
  }, [res]);

  useEffect(() => {
    if (!aspectOptions.includes(ratio)) {
      setRatio(aspectOptions.includes("9:16") ? "9:16" : aspectOptions[0]);
    }
  }, [aspectOptions, ratio]);

  useEffect(() => {
    if (!durationOptions.includes(duration)) {
      setDuration(durationOptions[0]);
    }
  }, [durationOptions, duration]);
  const activeShot = results.find((r) => r.id === activeId) ?? results[0] ?? null;
  const wishlistedUrls = useMemo(
    () => new Set(wishlist.map((w) => w.image_url)),
    [wishlist],
  );

  const loadWishlist = useCallback(async () => {
    try {
      setWishlist(await wishlistApi.list());
    } catch {
      /* optional until migration applied */
    }
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = !q
      ? catalog
      : catalog.filter(
          (m) =>
            m.friendly_name.toLowerCase().includes(q) ||
            m.provider_model_id.toLowerCase().includes(q) ||
            (m.description ?? "").toLowerCase().includes(q) ||
            m.category.toLowerCase().includes(q) ||
            m.slug.toLowerCase().includes(q),
        );
    // Featured → recommended → rest
    return [...list].sort((a, b) => {
      const rank = (m: typeof a) =>
        isFeaturedVideoModel(m) ? 0 : isRecommendedVideoModel(m) ? 1 : 2;
      const ar = rank(a);
      const br = rank(b);
      if (ar !== br) return ar - br;
      return (a.display_order ?? 0) - (b.display_order ?? 0);
    });
  }, [catalog, search]);

  const referencesRef = useRef(references);
  referencesRef.current = references;

  useEffect(() => {
    return () => {
      for (const item of referencesRef.current) {
        if (item.preview.startsWith("blob:")) URL.revokeObjectURL(item.preview);
      }
    };
  }, []);

  const clearReferences = () => {
    setReferences((prev) => {
      for (const item of prev) {
        if (item.preview.startsWith("blob:")) URL.revokeObjectURL(item.preview);
      }
      return [];
    });
    setUploadError(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  const removeReference = (id: string) => {
    setReferences((prev) => {
      const next = prev.filter((item) => {
        if (item.id !== id) return true;
        if (item.preview.startsWith("blob:")) URL.revokeObjectURL(item.preview);
        return false;
      });
      return next;
    });
    setUploadError(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  const addReferenceFiles = (incoming: FileList | File[] | null) => {
    if (!incoming || incoming.length === 0) return;
    const files = Array.from(incoming);
    const remaining = MAX_REFERENCE_IMAGES - references.length;
    if (remaining <= 0) {
      setUploadError(`You can upload up to ${MAX_REFERENCE_IMAGES} images.`);
      return;
    }

    const accepted: ReferenceItem[] = [];
    let rejectedType = false;
    let rejectedSize = false;

    for (const file of files.slice(0, remaining)) {
      if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
        rejectedType = true;
        continue;
      }
      if (file.size > MAX_REFERENCE_BYTES) {
        rejectedSize = true;
        continue;
      }
      accepted.push({
        id: `${file.name}-${file.size}-${file.lastModified}-${crypto.randomUUID()}`,
        file,
        preview: URL.createObjectURL(file),
      });
    }

    if (accepted.length) {
      setReferences((prev) => [...prev, ...accepted].slice(0, MAX_REFERENCE_IMAGES));
    }

    if (files.length > remaining) {
      setUploadError(`Only ${MAX_REFERENCE_IMAGES} images allowed. Extra files were skipped.`);
    } else if (rejectedType) {
      setUploadError("Use PNG, JPG, or WebP.");
    } else if (rejectedSize) {
      setUploadError("Each image must be 10 MB or smaller.");
    } else {
      setUploadError(null);
    }

    if (fileRef.current) fileRef.current.value = "";
  };

  const loadHistory = useCallback(async () => {
    try {
      const rows = (await generationsApi.listRecent(18, "video")) as Array<{
        id: string;
        prompt: string | null;
        application_status: string;
        failure_message?: string | null;
        generation_type?: string;
        input_configuration?: Record<string, unknown> | null;
        model_id?: string | null;
        model_catalog?: { friendly_name?: string } | null;
        generation_outputs?: Array<{
          id: string;
          original_provider_url: string | null;
          mime_type?: string | null;
        }>;
      }>;
      const shots: ResultShot[] = [];
      for (const row of rows) {
        if (row.generation_type && row.generation_type !== "video") continue;
        const cfg = row.input_configuration ?? {};
        const aspectRatio = typeof cfg.aspect_ratio === "string" ? cfg.aspect_ratio : null;
        const dur =
          typeof cfg.duration_seconds === "number"
            ? `${cfg.duration_seconds}s`
            : typeof cfg.duration === "string"
            ? cfg.duration
            : null;
        const outs = (row.generation_outputs ?? []).filter((o) => o.original_provider_url);
        // One card per generation (and per unique URL) — avoid duplicate thumbnails.
        if (outs.length) {
          const seenUrls = new Set<string>();
          for (const o of outs) {
            const url = o.original_provider_url as string;
            if (seenUrls.has(url)) continue;
            seenUrls.add(url);
            shots.push({
              id: o.id,
              outputId: o.id,
              generationId: row.id,
              url,
              label: row.application_status,
              status: row.application_status,
              prompt: row.prompt,
              aspectRatio,
              duration: dur,
              modelName: row.model_catalog?.friendly_name ?? null,
              modelId: row.model_id ?? null,
              mimeType: o.mime_type ?? "video/mp4",
            });
            break; // show latest/first output only in the gallery grid
          }
        } else if (
          row.application_status === "generating" ||
          row.application_status === "queued" ||
          row.application_status === "validating"
        ) {
          shots.push({
            id: row.id,
            generationId: row.id,
            url: null,
            label: "Generating…",
            status: row.application_status,
            prompt: row.prompt,
            aspectRatio,
            duration: dur,
            modelName: row.model_catalog?.friendly_name ?? null,
            modelId: row.model_id ?? null,
          });
        }
        // failed / failed_refunded / blocked — never show in gallery
      }
      // Global URL dedupe across generations (webhook + sync can insert twins).
      const deduped: ResultShot[] = [];
      const urls = new Set<string>();
      const genIds = new Set<string>();
      for (const s of shots) {
        if (s.url) {
          if (urls.has(s.url)) continue;
          urls.add(s.url);
        }
        if (s.generationId) {
          if (genIds.has(s.generationId) && s.url) continue;
          genIds.add(s.generationId);
        }
        deduped.push(s);
      }
      setResults(deduped);
      setActiveId((prev) => {
        if (prev && deduped.some((s) => s.id === prev)) return prev;
        return deduped[0]?.id ?? null;
      });
    } catch {
      /* history is best-effort */
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  const pollUntilDone = useCallback(async (
    generationId: string,
    meta: {
      prompt: string;
      aspectRatio: string;
      duration: string;
      modelName: string;
      modelId: string;
    },
  ) => {
    const pollStarted = Date.now();
    let createdAtMs: number | null = null;
    const maxLoops = Math.ceil(GENERATION_HARD_TIMEOUT_MS / 2000) + 5;
    let softWarned = false;

    const bumpProgress = (pct: number, label: string) => {
      setStatus(label);
      setResults((prev) =>
        prev.map((r) =>
          r.id === generationId || r.generationId === generationId
            ? {
                ...r,
                progressPct: pct,
                label: `${pct}%`,
                status: r.status === "completed" ? r.status : "generating",
              }
            : r,
        ),
      );
    };

    for (let i = 0; i < maxLoops; i++) {
      if (stopRequestedRef.current) return;

      // Prefer fal sync so we don't depend only on webhooks
      if (i === 0 || i % 2 === 1) {
        try {
          await generationsApi.syncStatus(generationId);
        } catch {
          /* sync is best-effort; DB poll still runs */
        }
      }

      if (stopRequestedRef.current) return;

      const gen = (await generationsApi.get(generationId)) as {
        application_status: string;
        failure_message?: string | null;
        provider_status?: string | null;
        created_at?: string;
      };
      if (!createdAtMs && gen.created_at) {
        createdAtMs = new Date(gen.created_at).getTime();
      }
      const elapsed = Math.max(0, Date.now() - (createdAtMs || pollStarted));
      const st = gen.application_status;
      const elapsedMin = Math.floor(elapsed / 60000);
      const elapsedSec = Math.floor((elapsed % 60000) / 1000);
      const elapsedLabel = elapsedMin > 0 ? `${elapsedMin}m ${elapsedSec}s` : `${elapsedSec}s`;
      const providerBit = gen.provider_status ? ` · ${gen.provider_status}` : "";
      const pct = estimateProgressPct(elapsed, gen.provider_status, st);

      if (elapsed >= GENERATION_SOFT_TIMEOUT_MS && (st === "generating" || st === "queued")) {
        setCanStop(true);
        if (!softWarned) {
          softWarned = true;
          setError(
            "Still processing (over 3 min). You can Stop to cancel at fal and refund credits if it has not finished yet.",
          );
        }
      }

      bumpProgress(
        pct,
        st === "queued"
          ? `Queued${providerBit} · ${elapsedLabel} · ${pct}%`
          : st === "generating"
          ? `Generating${providerBit} · ${elapsedLabel} · ${pct}%`
          : `${st} · ${pct}%`,
      );

      if (st === "completed") {
        const outs = await generationsApi.listOutputs(generationId);
        const ready = outs.filter((o) => o.original_provider_url);
        if (ready.length) {
          setError(null);
          setResults((prev) => {
            const mapped = ready.map((o) => ({
              id: o.id,
              outputId: o.id,
              generationId,
              url: o.original_provider_url as string,
              label: "New",
              status: "completed",
              progressPct: 100,
              prompt: meta.prompt,
              aspectRatio: meta.aspectRatio,
              duration: meta.duration,
              modelName: meta.modelName,
              modelId: meta.modelId,
              mimeType: o.mime_type ?? "video/mp4",
            }));
            return [
              ...mapped,
              ...prev.filter((p) => p.id !== generationId && p.generationId !== generationId),
            ];
          });
          setActiveId(ready[0].id);
          setStatus("Completed · 100%");
          return;
        }
      }

      if (st === "failed" || st === "failed_refunded") {
        throw new Error(gen.failure_message || "Generation failed");
      }

      // Hard timeout: try one last sync (no fal cancel). Fail only if still no video.
      if (elapsed >= GENERATION_HARD_TIMEOUT_MS) {
        try {
          await generationsApi.syncStatus(generationId, { force_fail: true });
        } catch {
          /* best-effort */
        }
        const last = (await generationsApi.get(generationId)) as {
          application_status: string;
          failure_message?: string | null;
        };
        if (last.application_status === "completed") {
          const outs = await generationsApi.listOutputs(generationId);
          const ready = outs.filter((o) => o.original_provider_url);
          if (ready.length) {
            setError(null);
            setResults((prev) => [
              ...ready.map((o) => ({
                id: o.id,
                outputId: o.id,
                generationId,
                url: o.original_provider_url as string,
                label: "New",
                status: "completed" as const,
                progressPct: 100,
                prompt: meta.prompt,
                aspectRatio: meta.aspectRatio,
                duration: meta.duration,
                modelName: meta.modelName,
                modelId: meta.modelId,
                mimeType: o.mime_type ?? "video/mp4",
              })),
              ...prev.filter((p) => p.id !== generationId && p.generationId !== generationId),
            ]);
            setActiveId(ready[0].id);
            return;
          }
        }
        throw new Error(
          last.failure_message ||
            "No video after 12 minutes. If fal charged you, tap Refresh — we will try to recover the file.",
        );
      }

      await sleep(2000);
    }

    throw new Error(
      "No video after 12 minutes. If fal charged you, tap Refresh — we will try to recover the file.",
    );
  }, []);

  const refreshAndSync = useCallback(async () => {
    try {
      const rows = (await generationsApi.listRecent(12, "video")) as Array<{
        id: string;
        application_status: string;
        generation_type?: string;
      }>;
      for (const row of rows) {
        if (row.generation_type !== "video") continue;
        // Also re-check timed-out jobs — fal may have finished after we refunded.
        if (
          row.application_status === "generating" ||
          row.application_status === "queued" ||
          row.application_status === "validating" ||
          row.application_status === "failed_refunded" ||
          row.application_status === "failed"
        ) {
          try {
            await generationsApi.syncStatus(row.id);
          } catch {
            /* ignore */
          }
        }
      }
    } catch {
      /* ignore */
    }
    await loadHistory();
    await refreshWallet();
  }, [loadHistory, refreshWallet]);

  // On load: paint history first (no fake templates flash), then sync fal in background.
  useEffect(() => {
    let cancelled = false;
    const boot = async () => {
      await loadHistory();
      await loadWishlist();
      if (cancelled) return;

      // Background sync — do not block the gallery on fal status calls.
      void refreshAndSync();

      const rows = (await generationsApi.listRecent(8, "video").catch(() => [])) as Array<{
        id: string;
        application_status: string;
        generation_type?: string;
        prompt?: string | null;
        input_configuration?: Record<string, unknown> | null;
        model_catalog?: { friendly_name?: string } | null;
        model_id?: string | null;
      }>;
      const active = rows.find(
        (r) =>
          r.generation_type === "video" &&
          (r.application_status === "generating" || r.application_status === "queued"),
      );
      if (!active || cancelled) return;
      setBusy(true);
      setStatus("Resuming…");
      stopRequestedRef.current = false;
      setCanStop(false);
      setActiveGenId(active.id);
      const cfg = active.input_configuration ?? {};
      try {
        await pollUntilDone(active.id, {
          prompt: active.prompt || "",
          aspectRatio: typeof cfg.aspect_ratio === "string" ? cfg.aspect_ratio : "9:16",
          duration:
            typeof cfg.duration === "string"
              ? cfg.duration
              : typeof cfg.duration_seconds === "number"
              ? `${cfg.duration_seconds}s`
              : "5s",
          modelName: active.model_catalog?.friendly_name || "Video",
          modelId: active.model_id || "",
        });
        if (!cancelled) {
          if (!stopRequestedRef.current) setStatus("Completed");
          await refreshWallet();
          await loadHistory();
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Generation failed");
          setStatus(null);
          await refreshAndSync();
        }
      } finally {
        if (!cancelled) setBusy(false);
      }
    };
    void boot();
    return () => {
      cancelled = true;
    };
    // Run once on mount — refreshAndSync/pollUntilDone are stable enough for boot.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onGenerate = async () => {
    setError(null);
    setUploadError(null);
    if (!selected) {
      setError("No active model available");
      return;
    }
    if (!prompt.trim()) {
      setError("Add a prompt before generating.");
      return;
    }
    const { prompt: providerPrompt, compacted } = compactPromptForProvider(
      prompt,
      maxPromptChars,
    );
    if (providerPrompt.length > maxPromptChars) {
      setError(
        `Prompt is too long for ${selected.friendly_name} (${prompt.length.toLocaleString()}/${maxPromptChars.toLocaleString()} max). Shorten it or click “Use short prompt”.`,
      );
      return;
    }
    if (credits < creditCost) {
      setError(`You need ${creditCost} credits, but your current balance is ${credits}.`);
      return;
    }
    if (res === "4K" || res === "4k") {
      setError("4K is launching soon. Please choose 720p or 1080p.");
      return;
    }
    if (!aspectOptions.includes(ratio)) {
      setError(`Aspect ratio ${ratio} is not supported for this model.`);
      return;
    }

    setBusy(true);
    setStatus("Validating");
    stopRequestedRef.current = false;
    setCanStop(false);
    setStopping(false);
    setActiveGenId(null);
    const pendingId = `pending-${Date.now()}`;
    const meta = {
      prompt,
      aspectRatio: ratio,
      duration,
      modelName: selected.friendly_name,
      modelId: selected.id,
    };
    setResults((prev) => [
      {
        id: pendingId,
        url: null,
        label: "4%",
        status: "generating",
        progressPct: 4,
        ...meta,
      },
      ...prev,
    ]);
    setActiveId(pendingId);

    try {
      const referenceUrls: string[] = [];
      if (references.length) {
        setStatus(`Uploading references (0/${references.length})`);
        for (let i = 0; i < references.length; i++) {
          setStatus(`Uploading references (${i + 1}/${references.length})`);
          referenceUrls.push(await uploadReferenceImage(references[i].file));
        }
      }

      setStatus(compacted ? "Queued (compacted long prompt)" : "Queued");
      const submitRes = (await generationsApi.submit({
        model_id: selected.id,
        prompt: providerPrompt,
        aspect_ratio: ratio,
        resolution: res,
        idempotency_key: crypto.randomUUID(),
        input_configuration: {
          duration_seconds: secs,
          duration,
          aspect_ratio: ratio,
          resolution: res,
          model_name: selected.friendly_name,
          ...(compacted
            ? {
              prompt_compacted: true,
              original_prompt_length: prompt.length,
              original_prompt: prompt.slice(0, 500),
            }
            : {}),
          ...(referenceUrls[0] ? { reference_image_url: referenceUrls[0] } : {}),
          ...(referenceUrls.length ? { reference_image_urls: referenceUrls } : {}),
        },
      })) as { generation_id: string; application_status: string };

      setResults((prev) =>
        prev.map((r) =>
          r.id === pendingId
            ? { ...r, id: submitRes.generation_id, generationId: submitRes.generation_id }
            : r,
        ),
      );
      setActiveId(submitRes.generation_id);
      setActiveGenId(submitRes.generation_id);

      setStatus("Generating");
      await pollUntilDone(submitRes.generation_id, meta);
      if (stopRequestedRef.current) {
        setStatus(null);
      } else {
        setStatus("Completed");
      }
      await refreshWallet();
      await loadHistory();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Generation failed";
      setError(message);
      setStatus(null);
      // Keep in-progress cards on timeout — fal may still finish; Refresh will pick it up.
      const isTimeout = /timed out/i.test(message);
      if (!isTimeout) {
        setResults((prev) =>
          prev.filter((r) => r.id !== pendingId && r.status !== "generating"),
        );
      } else {
        await refreshAndSync();
      }
      await refreshWallet();
    } finally {
      setBusy(false);
      if (!stopRequestedRef.current) {
        setCanStop(false);
        setActiveGenId(null);
      }
    }
  };

  const onStopGeneration = async () => {
    const generationId =
      activeGenId ||
      results.find(
        (r) =>
          r.status === "generating" ||
          r.status === "queued" ||
          r.status === "validating",
      )?.generationId ||
      results.find(
        (r) =>
          r.status === "generating" ||
          r.status === "queued" ||
          r.status === "validating",
      )?.id;
    if (!generationId || stopping || generationId.startsWith("pending-")) return;

    stopRequestedRef.current = true;
    setStopping(true);
    setStatus("Stopping…");
    try {
      const res = (await generationsApi.syncStatus(generationId, {
        user_stop: true,
      })) as {
        application_status?: string;
        failure_message?: string | null;
        output_url?: string;
      };

      if (res.application_status === "completed") {
        setError(null);
        const outs = await generationsApi.listOutputs(generationId);
        const ready = outs.filter((o) => o.original_provider_url);
        if (ready.length) {
          setResults((prev) => [
            ...ready.map((o) => ({
              id: o.id,
              outputId: o.id,
              generationId,
              url: o.original_provider_url as string,
              label: "New",
              status: "completed" as const,
              progressPct: 100,
              prompt:
                prev.find((p) => p.generationId === generationId || p.id === generationId)
                  ?.prompt || prompt,
              aspectRatio: ratio,
              duration,
              modelName: selected?.friendly_name,
              modelId: selected?.id,
              mimeType: o.mime_type ?? "video/mp4",
            })),
            ...prev.filter((p) => p.id !== generationId && p.generationId !== generationId),
          ]);
          setActiveId(ready[0].id);
          setStatus("Completed · 100%");
        }
      } else {
        const msg =
          res.failure_message ||
          "Stopped. Credits refunded (fal had not finished / charged yet).";
        setError(msg);
        setStatus(null);
        // Remove stopped/failed card — gallery only shows successful (or in-flight) videos.
        setResults((prev) =>
          prev.filter(
            (r) => r.id !== generationId && r.generationId !== generationId,
          ),
        );
        setActiveId((prev) => (prev === generationId ? null : prev));
      }
      await refreshWallet();
      await loadHistory();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not stop generation");
      // Allow poll to continue if stop failed
      stopRequestedRef.current = false;
    } finally {
      setStopping(false);
      setCanStop(false);
      setBusy(false);
      setActiveGenId(null);
    }
  };

  const toggleWishlist = async (shot: ResultShot) => {
    if (!shot.url) return;
    setWishBusy(true);
    setError(null);
    try {
      if (wishlistedUrls.has(shot.url)) {
        const existing = wishlist.find((w) => w.image_url === shot.url);
        if (existing) await wishlistApi.remove(existing.id);
        else await wishlistApi.removeByImageUrl(shot.url);
      } else {
        await wishlistApi.add({
          image_url: shot.url,
          prompt: shot.prompt,
          aspect_ratio: shot.aspectRatio ?? ratio,
          quality: res,
          model_name: shot.modelName ?? selected?.friendly_name,
          model_id: shot.modelId ?? selected?.id,
          generation_id: shot.generationId,
          output_id: shot.outputId,
          settings: {
            media_type: "video",
            aspect_ratio: shot.aspectRatio ?? ratio,
            duration: shot.duration ?? duration,
            resolution: res,
          },
        });
      }
      await loadWishlist();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update wishlist");
    } finally {
      setWishBusy(false);
    }
  };

  const removeWish = async (item: WishlistItem) => {
    setWishBusy(true);
    try {
      await wishlistApi.remove(item.id);
      await loadWishlist();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not remove from wishlist");
    } finally {
      setWishBusy(false);
    }
  };

  return (
    <>
      <TopNav />
      <div className="create-page">
        <aside className="create-panel">
          <div className="create-tabs">
            <button
              type="button"
              className={mainTab === "create" ? "active" : undefined}
              onClick={() => setMainTab("create")}
            >
              Create Video
            </button>
            <button
              type="button"
              className={mainTab === "wishlist" ? "active" : undefined}
              onClick={() => setMainTab("wishlist")}
            >
              Wishlist{wishlist.length ? ` · ${wishlist.length}` : ""}
            </button>
          </div>

          {mainTab === "create" ? (
          <>
          <div className="create-panel-body">
            <div className="model-card">
              <Placeholder label="" className="thumb" variant="pink" />
              <div>
                <span>{selected?.quality_tier?.toUpperCase() ?? "GENERAL"}</span>
                <strong>{selected?.friendly_name ?? "Loading…"}</strong>
                <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                  {selected ? `${creditCost} credits` : null}
                </div>
              </div>
              <button type="button" className="change" onClick={() => setPicker(true)}>
                Change
              </button>
            </div>

            <div
              className={`upload-box${references.length ? " has-file" : ""}`}
              role="button"
              tabIndex={0}
              onClick={() => {
                if (references.length >= MAX_REFERENCE_IMAGES) return;
                fileRef.current?.click();
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  if (references.length < MAX_REFERENCE_IMAGES) fileRef.current?.click();
                }
              }}
              onDragOver={(e) => {
                e.preventDefault();
                e.currentTarget.classList.add("drag");
              }}
              onDragLeave={(e) => e.currentTarget.classList.remove("drag")}
              onDrop={(e) => {
                e.preventDefault();
                e.currentTarget.classList.remove("drag");
                addReferenceFiles(e.dataTransfer.files);
              }}
            >
              <input
                ref={fileRef}
                type="file"
                accept="image/png,image/jpeg,image/jpg,image/webp"
                multiple
                hidden
                onChange={(e) => addReferenceFiles(e.target.files)}
              />
              {references.length ? (
                <div className="upload-preview" onClick={(e) => e.stopPropagation()}>
                  <div className="upload-preview-grid">
                    {references.map((item, index) => (
                      <div key={item.id} className="upload-preview-tile">
                        <img src={item.preview} alt={`Reference ${index + 1}`} />
                        <button
                          type="button"
                          className="upload-preview-remove"
                          aria-label={`Remove image ${index + 1}`}
                          onClick={() => removeReference(item.id)}
                        >
                          ×
                        </button>
                      </div>
                    ))}
                    {references.length < MAX_REFERENCE_IMAGES ? (
                      <button
                        type="button"
                        className="upload-preview-add"
                        onClick={() => fileRef.current?.click()}
                      >
                        + Add
                      </button>
                    ) : null}
                  </div>
                  <div className="upload-preview-actions">
                    <Button type="button" variant="ghost" onClick={() => fileRef.current?.click()}>
                      Add more
                    </Button>
                    <Button type="button" variant="ghost" onClick={clearReferences}>
                      Clear all
                    </Button>
                  </div>
                  <p className="upload-count">
                    {references.length}/{MAX_REFERENCE_IMAGES} images · PNG/JPG · up to 10 MB each
                  </p>
                </div>
              ) : (
                <>
                  <strong>
                    Upload images or <em>generate them</em>
                  </strong>
                  <p>
                    Optional references · up to {MAX_REFERENCE_IMAGES} · PNG/JPG · 10 MB each
                  </p>
                </>
              )}
            </div>
            {uploadError ? (
              <p style={{ margin: "-4px 0 0", fontSize: 12, color: "var(--danger, #f87171)" }}>
                {uploadError}
              </p>
            ) : null}
            {references.length > 0 && selected && !selected.supports_image_input ? (
              <p style={{ margin: "-4px 0 0", fontSize: 12, color: "var(--text-muted)" }}>
                This model may ignore reference images (text-only).
              </p>
            ) : null}

            <div>
              <div className="field-label">
                Prompt
                <span
                  className={`field-label-meta${promptOverLimit ? " warn" : ""}`}
                >
                  {prompt.length.toLocaleString()}/{maxPromptChars.toLocaleString()} max
                </span>
              </div>
              <textarea
                className="textarea"
                value={prompt}
                onChange={(e) => {
                  setPrompt(e.target.value);
                  if (error) setError(null);
                }}
                placeholder="Describe the scene you imagine, with details."
              />
              {promptOverLimit ? (
                <div className="prompt-limit-hint">
                  <p>
                    This model allows {maxPromptChars.toLocaleString()} characters. Your STYLE_LOCK
                    template is too long — we’ll use the FINAL_VIDEO_PROMPT section if present.
                  </p>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => {
                      const { prompt: next } = compactPromptForProvider(prompt, maxPromptChars);
                      setPrompt(next);
                      setError(null);
                    }}
                  >
                    Use short prompt
                  </Button>
                </div>
              ) : null}
            </div>

            <div className="settings-row">
              {durationOptions.map((d) => (
                <button
                  key={d}
                  type="button"
                  className={duration === d ? "active" : undefined}
                  onClick={() => setDuration(d)}
                  title={
                    selected
                      ? `${estimateJobCredits(selected, {
                          durationSeconds: parseDurationSeconds(d),
                          resolution: res,
                        })} credits`
                      : undefined
                  }
                >
                  {d}
                </button>
              ))}
            </div>

            <div>
              <div className="field-label">Aspect ratio</div>
              <Segment
                options={aspectOptions}
                value={ratio}
                onChange={setRatio}
              />
            </div>

            <div>
              <div className="field-label">Resolution</div>
              <div className="settings-row">
                {(["720p", "1080p"] as const).map((r) => (
                  <button
                    key={r}
                    type="button"
                    className={res === r ? "active" : undefined}
                    onClick={() => setRes(r)}
                  >
                    {r}
                  </button>
                ))}
                <button
                  type="button"
                  className="res-soon"
                  disabled
                  aria-disabled="true"
                  title="4K is launching soon"
                >
                  <span>4K</span>
                  <small>Launching soon</small>
                </button>
              </div>
            </div>

            <div className="create-note">
              Balance {credits} · After generation ~{Math.max(0, credits - creditCost)}
              {status ? ` · ${status}` : ""}
            </div>
            {error ? <div className="field-error">{error}</div> : null}
          </div>

          <div className="create-panel-foot">
            <Button
              variant="primary"
              block
              size="lg"
              disabled={busy || inFlight || stopping || !selected || !prompt.trim()}
              onClick={() => void onGenerate()}
            >
              {busy || inFlight
                ? stopping
                  ? "Stopping…"
                  : "Generating…"
                : `Generate ✦ ${creditCost} credits`}
            </Button>
            {canStop && (busy || inFlight) ? (
              <Button
                variant="ghost"
                block
                className="stop-gen-btn"
                style={{ marginTop: 8 }}
                disabled={stopping}
                onClick={() => void onStopGeneration()}
              >
                {stopping ? "Stopping…" : "Stop · refund credits"}
              </Button>
            ) : null}
            {error?.includes("need") ? (
              <Button variant="ghost" block style={{ marginTop: 8 }} onClick={() => nav("/pricing")}>
                Buy credits
              </Button>
            ) : null}
          </div>
          </>
          ) : (
            <div className="create-panel-body wishlist-panel">
              <p className="wishlist-intro">
                Saved images and videos with their prompt and settings. Click an item to reopen it.
              </p>
              {wishlist.length === 0 ? (
                <div className="wishlist-empty">
                  No wishlist items yet. Generate a video, then tap Wishlist on the result.
                </div>
              ) : (
                wishlist.map((item) => {
                  const video = isWishlistVideo(item);
                  return (
                    <article key={item.id} className="wishlist-card">
                      <button
                        type="button"
                        className="wishlist-thumb"
                        onClick={() => {
                          setMainTab("create");
                          if (!video) {
                            nav("/app/create/image");
                            return;
                          }
                          setResults((prev) => {
                            if (prev.some((p) => p.url === item.image_url)) return prev;
                            return [
                              {
                                id: item.output_id ?? item.id,
                                outputId: item.output_id ?? undefined,
                                generationId: item.generation_id ?? undefined,
                                url: item.image_url,
                                label: "Wishlist",
                                status: "completed",
                                prompt: item.prompt,
                                aspectRatio: item.aspect_ratio,
                                duration:
                                  typeof item.settings?.duration === "string"
                                    ? item.settings.duration
                                    : duration,
                                modelName: item.model_name,
                                modelId: item.model_id,
                                mimeType: "video/mp4",
                              },
                              ...prev,
                            ];
                          });
                          setActiveId(item.output_id ?? item.id);
                          if (item.prompt) setPrompt(item.prompt);
                          if (item.aspect_ratio) setRatio(item.aspect_ratio);
                        }}
                      >
                        {video ? (
                          <video src={item.image_url} muted playsInline preload="metadata" />
                        ) : (
                          <img src={item.image_url} alt={item.prompt ?? "Wishlist item"} />
                        )}
                      </button>
                      <div className="wishlist-meta">
                        <p>{item.prompt || "No prompt saved"}</p>
                        <div className="wishlist-tags">
                          <span>{video ? "video" : "image"}</span>
                          {item.model_name ? <span>{item.model_name}</span> : null}
                          {item.aspect_ratio ? <span>{item.aspect_ratio}</span> : null}
                          {typeof item.settings?.duration === "string" ? (
                            <span>{item.settings.duration}</span>
                          ) : null}
                        </div>
                        <div className="wishlist-actions">
                          <Button
                            type="button"
                            variant="ghost"
                            onClick={() =>
                              void downloadMedia(
                                item.image_url,
                                `dady-wish-${item.id.slice(0, 8)}.${video ? "mp4" : "jpg"}`,
                              )
                            }
                          >
                            Download
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            disabled={wishBusy}
                            onClick={() => void removeWish(item)}
                          >
                            Remove
                          </Button>
                        </div>
                      </div>
                    </article>
                  );
                })
              )}
            </div>
          )}
        </aside>

        <main className="create-main">
          <div className="create-main-bar">
            <button type="button" className="pill" onClick={() => void refreshAndSync()}>
              ◫ Refresh
            </button>
            <button type="button" className="pill" onClick={() => setMainTab("wishlist")}>
              ◫ Wishlist · {wishlist.length}
            </button>
          </div>

          {activeShot?.url ? (
            <div className="result-hero">
              <div className="result-frame">
                <AutoPlayVideo src={activeShot.url} controls />
              </div>
              <div className="result-meta">
                <div className="result-meta-copy">
                  <p>{activeShot.prompt}</p>
                  <div className="wishlist-tags">
                    {activeShot.modelName ? <span>{activeShot.modelName}</span> : null}
                    {activeShot.aspectRatio ? <span>{activeShot.aspectRatio}</span> : null}
                    {activeShot.duration ? <span>{activeShot.duration}</span> : null}
                  </div>
                </div>
                <div className="result-actions">
                  <button
                    type="button"
                    className="result-action"
                    disabled={wishBusy}
                    onClick={() => void toggleWishlist(activeShot)}
                  >
                    {wishlistedUrls.has(activeShot.url) ? "Wishlisted" : "Wishlist"}
                  </button>
                  <button
                    type="button"
                    className="result-action"
                    onClick={() =>
                      void downloadMedia(
                        activeShot.url!,
                        `dady-${(activeShot.id || "video").slice(0, 8)}.mp4`,
                      )
                    }
                  >
                    Download
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="promo-strip">
              <div style={{ flex: 1, minWidth: 0 }}>
                <strong>
                  {busy || inFlight
                    ? `Generating your video… ${
                        activeShot?.progressPct != null ? `${activeShot.progressPct}%` : ""
                      }`
                    : "Creator Video Boost"}
                </strong>
                <span>
                  {busy || inFlight
                    ? status || "Queued — max wait 3 minutes"
                    : "Priority queue + cinematic presets for festival reels"}
                </span>
                {busy || inFlight ? (
                  <div className="gen-progress">
                    <Progress value={activeShot?.progressPct ?? 8} variant="enhance" />
                    <em>{activeShot?.progressPct ?? 8}%</em>
                  </div>
                ) : null}
              </div>
              {canStop && (busy || inFlight) ? (
                <Button
                  variant="ghost"
                  className="stop-gen-btn"
                  disabled={stopping}
                  onClick={() => void onStopGeneration()}
                >
                  {stopping ? "Stopping…" : "Stop"}
                </Button>
              ) : !busy && !inFlight ? (
                <Button variant="lime" onClick={() => nav("/pricing")}>
                  Upgrade plan
                </Button>
              ) : null}
            </div>
          )}

          <div className="create-gallery">
            {historyLoading ? (
              Array.from({ length: 6 }, (_, i) => (
                <div key={`skel-${i}`} className="shot shot-skeleton" aria-hidden>
                  <div className="shot-skeleton-inner" />
                </div>
              ))
            ) : results.length ? (
              results.map((shot) => {
                const isPending =
                  !shot.url &&
                  (shot.status === "generating" ||
                    shot.status === "queued" ||
                    shot.status === "validating");
                const pct = shot.progressPct ?? (isPending ? 8 : undefined);
                return (
                  <button
                    key={shot.id}
                    type="button"
                    className={`shot${activeId === shot.id ? " active" : ""}`}
                    onClick={() => {
                      if (shot.url) setActiveId(shot.id);
                    }}
                  >
                    {shot.url ? (
                      <AutoPlayVideo src={shot.url} className="shot-video" />
                    ) : isPending ? (
                      <div className="shot-pending">
                        <span className="spin" aria-hidden />
                        <strong>{pct ?? 0}%</strong>
                        <span>Generating…</span>
                        <div className="shot-progress">
                          <i style={{ width: `${pct ?? 0}%` }} />
                        </div>
                      </div>
                    ) : (
                      <Placeholder label={shot.label || "Failed"} variant="pink" />
                    )}
                  </button>
                );
              })
            ) : (
              videoStudioTemplates.map((t) => (
                <button
                  key={t.label}
                  type="button"
                  className="shot template-shot"
                  onClick={() => setPrompt(t.prompt)}
                  title={`Use template: ${t.label}`}
                >
                  <AutoPlayVideo src={t.videoUrl} className="shot-video" />
                  <span className="shot-label">{t.label}</span>
                </button>
              ))
            )}
          </div>

          <div className="steps-row">
            <article className="step-card">
              <Placeholder label="One click preset" className="media" variant="blue" />
              <div className="body">
                <h3>One-click presets</h3>
                <p>Portrait video slots ready — swap in your generated clips later.</p>
              </div>
            </article>
            <article className="step-card">
              <Placeholder label="Get video" className="media" variant="pink" />
              <div className="body">
                <h3>Get video</h3>
                <p>Export MP4 and share to WhatsApp, Reels, or your storefront.</p>
              </div>
            </article>
          </div>
        </main>
      </div>

      {picker ? (
        <div className="model-modal-backdrop" onClick={() => setPicker(false)}>
          <div className="model-modal" onClick={(e) => e.stopPropagation()}>
            <input
              placeholder="Search models…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {filtered.map((m) => (
              <button
                key={m.id}
                type="button"
                className={`model-option${selected?.id === m.id ? " active" : ""}`}
                onClick={() => {
                  setModelId(m.id);
                  setPicker(false);
                }}
              >
                <strong>
                  {m.friendly_name}
                  {isFeaturedVideoModel(m) ? (
                    <em className="model-rec-badge model-rec-badge--star">★ Best value</em>
                  ) : isRecommendedVideoModel(m) ? (
                    <em className="model-rec-badge">Recommended</em>
                  ) : null}
                </strong>
                <span>
                  {m.category} · {formatModelPriceLabel(m, secs, res)}
                </span>
              </button>
            ))}
            {!filtered.length ? <p style={{ padding: 12 }}>No models match.</p> : null}
          </div>
        </div>
      ) : null}
      <MobileBottomNav />
    </>
  );
}
