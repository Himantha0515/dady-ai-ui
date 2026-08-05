import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { TopNav } from "../layouts/TopNav";
import { Button, Placeholder, Segment } from "../components/ui";
import { useModels, useWallet } from "../hooks/useCatalog";
import { estimateJobCredits, formatModelPriceLabel } from "../lib/pricing/credits";
import {
  generationsApi,
  uploadReferenceImage,
  wishlistApi,
  type WishlistItem,
} from "../lib/api/catalog";
import { isCuratedImageModel } from "../lib/models/curatedImageModels";
import { isWishlistVideo } from "../lib/wishlistMedia";
import "./CreateStudio.css";

type ResultShot = {
  id: string;
  outputId?: string;
  generationId?: string;
  url: string | null;
  label: string;
  status: string;
  prompt?: string | null;
  aspectRatio?: string | null;
  quality?: string | null;
  modelName?: string | null;
  modelId?: string | null;
};

const placeholderShots = [
  ["Studio mug", "lime"],
  ["Kurta flat-lay", "pink"],
  ["Storefront", "blue"],
  ["Festival poster", "default"],
  ["Avatar look", "pink"],
  ["Banner wide", "blue"],
] as const;

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function downloadImage(url: string, filename: string) {
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

export function ImageStudio() {
  const nav = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);
  const { data: rawCatalog = [] } = useModels("image");
  const catalog = useMemo(
    () => rawCatalog.filter((m) => isCuratedImageModel(m)).slice(0, 10),
    [rawCatalog],
  );
  const { credits, refreshWallet } = useWallet();
  const [mainTab, setMainTab] = useState<"create" | "wishlist">("create");
  const [modelId, setModelId] = useState<string | null>(null);
  const [ratio, setRatio] = useState("4:5");
  const [quality, setQuality] = useState("HD");
  const [outputs, setOutputs] = useState("1");
  const [picker, setPicker] = useState(false);
  const [modelSearch, setModelSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<ResultShot[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [wishlist, setWishlist] = useState<WishlistItem[]>([]);
  const [wishBusy, setWishBusy] = useState(false);
  const [referenceFile, setReferenceFile] = useState<File | null>(null);
  const [referencePreview, setReferencePreview] = useState<string | null>(null);
  const [prompt, setPrompt] = useState(
    "Ceramic coffee mug on marble, soft window light, shallow depth of field",
  );

  const selected = useMemo(() => {
    if (modelId) return catalog.find((m) => m.id === modelId) ?? catalog[0];
    if (quality === "Prem") return catalog.find((m) => m.quality_tier === "premium") ?? catalog[0];
    if (quality === "HD") return catalog.find((m) => m.quality_tier === "hd") ?? catalog[0];
    return catalog.find((m) => m.quality_tier === "fast" || m.quality_tier === "standard") ?? catalog[0];
  }, [catalog, modelId, quality]);

  const filteredCatalog = useMemo(() => {
    const q = modelSearch.trim().toLowerCase();
    if (!q) return catalog;
    return catalog.filter(
      (m) =>
        m.friendly_name.toLowerCase().includes(q) ||
        m.provider_model_id.toLowerCase().includes(q) ||
        (m.description ?? "").toLowerCase().includes(q) ||
        m.category.toLowerCase().includes(q),
    );
  }, [catalog, modelSearch]);

  const creditCost = selected
    ? estimateJobCredits(selected, { numImages: Number(outputs) || 1 })
    : 5;
  const totalCost = creditCost;

  const activeShot = useMemo(
    () => results.find((r) => r.id === activeId) ?? results.find((r) => r.url) ?? null,
    [results, activeId],
  );

  const wishlistedUrls = useMemo(() => new Set(wishlist.map((w) => w.image_url)), [wishlist]);

  const loadWishlist = useCallback(async () => {
    try {
      setWishlist(await wishlistApi.list());
    } catch {
      /* optional until migration applied */
    }
  }, []);

  const loadHistory = useCallback(async () => {
    try {
      const rows = (await generationsApi.listRecent(18, "image")) as Array<{
        id: string;
        prompt: string | null;
        application_status: string;
        generation_type?: string;
        input_configuration?: Record<string, unknown> | null;
        model_id?: string | null;
        model_catalog?: { friendly_name?: string; quality_tier?: string } | null;
        generation_outputs?: Array<{
          id: string;
          original_provider_url: string | null;
          mime_type?: string | null;
        }>;
      }>;
      const shots: ResultShot[] = [];
      const seenUrls = new Set<string>();
      for (const row of rows) {
        // Image studio must never show video jobs.
        if (row.generation_type && row.generation_type !== "image") continue;
        const cfg = row.input_configuration ?? {};
        const aspectRatio = typeof cfg.aspect_ratio === "string" ? cfg.aspect_ratio : null;
        const q = typeof cfg.quality === "string" ? cfg.quality : null;
        const outs = row.generation_outputs ?? [];
        if (outs.length) {
          for (const o of outs) {
            if (!o.original_provider_url) continue;
            const mime = (o.mime_type || "").toLowerCase();
            const url = o.original_provider_url;
            // Skip video files that slipped into an image job / wrong mime.
            if (mime.startsWith("video/") || /\.(mp4|webm|mov)(\?|$)/i.test(url)) continue;
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
              quality: q,
              modelName: row.model_catalog?.friendly_name ?? null,
              modelId: row.model_id ?? null,
            });
          }
        } else if (row.application_status === "generating" || row.application_status === "queued") {
          shots.push({
            id: row.id,
            generationId: row.id,
            url: null,
            label: "Generating…",
            status: row.application_status,
            prompt: row.prompt,
            aspectRatio,
            quality: q,
            modelName: row.model_catalog?.friendly_name ?? null,
            modelId: row.model_id ?? null,
          });
        }
      }
      setResults(shots);
      setActiveId((prev) => {
        if (prev && shots.some((s) => s.id === prev)) return prev;
        return shots.find((s) => s.url)?.id ?? shots[0]?.id ?? null;
      });
    } catch {
      /* history is best-effort */
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadHistory();
    void loadWishlist();
  }, [loadHistory, loadWishlist]);

  useEffect(() => {
    return () => {
      if (referencePreview?.startsWith("blob:")) URL.revokeObjectURL(referencePreview);
    };
  }, [referencePreview]);

  const onPickReference = (file: File | null) => {
    if (referencePreview?.startsWith("blob:")) URL.revokeObjectURL(referencePreview);
    if (!file) {
      setReferenceFile(null);
      setReferencePreview(null);
      return;
    }
    const okType = ["image/png", "image/jpeg", "image/jpg", "image/webp"].includes(file.type);
    if (!okType) {
      setError("Use PNG, JPG, or WebP.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError("Image must be 10 MB or smaller.");
      return;
    }
    setError(null);
    setReferenceFile(file);
    setReferencePreview(URL.createObjectURL(file));
  };

  const pollUntilDone = async (
    generationId: string,
    meta: { prompt: string; aspectRatio: string; quality: string; modelName: string; modelId: string },
  ) => {
    for (let i = 0; i < 45; i++) {
      const gen = (await generationsApi.get(generationId)) as {
        application_status: string;
        failure_message?: string | null;
      };
      const st = gen.application_status;
      setStatus(st === "queued" ? "Queued" : st === "generating" ? "Generating" : st);

      if (st === "completed") {
        const outs = await generationsApi.listOutputs(generationId);
        const ready = outs.filter((o) => o.original_provider_url);
        if (ready.length) {
          setResults((prev) => {
            const mapped = ready.map((o) => ({
              id: o.id,
              outputId: o.id,
              generationId,
              url: o.original_provider_url as string,
              label: "New",
              status: "completed",
              prompt: meta.prompt,
              aspectRatio: meta.aspectRatio,
              quality: meta.quality,
              modelName: meta.modelName,
              modelId: meta.modelId,
            }));
            return [
              ...mapped,
              ...prev.filter((p) => p.id !== generationId && p.generationId !== generationId),
            ];
          });
          setActiveId(ready[0].id);
          return;
        }
      }

      if (st === "failed" || st === "failed_refunded") {
        throw new Error(gen.failure_message || "Generation failed");
      }

      await sleep(2000);
    }
    throw new Error("Timed out waiting for the image. Check History in a moment.");
  };

  const onGenerate = async () => {
    setError(null);
    if (!selected) {
      setError("No active model available");
      return;
    }
    if (credits < totalCost) {
      setError(`You need ${totalCost} credits, but your current balance is ${credits}.`);
      return;
    }
    setBusy(true);
    setStatus("Validating");
    const pendingId = `pending-${Date.now()}`;
    const meta = {
      prompt,
      aspectRatio: ratio,
      quality,
      modelName: selected.friendly_name,
      modelId: selected.id,
    };
    setResults((prev) => [
      {
        id: pendingId,
        url: null,
        label: "Generating…",
        status: "generating",
        ...meta,
        aspectRatio: ratio,
      },
      ...prev,
    ]);
    try {
      let referenceUrl: string | undefined;
      if (referenceFile) {
        setStatus("Uploading reference");
        referenceUrl = await uploadReferenceImage(referenceFile);
      }

      setStatus("Queued");
      const res = (await generationsApi.submit({
        model_id: selected.id,
        prompt,
        aspect_ratio: ratio,
        idempotency_key: crypto.randomUUID(),
        input_configuration: {
          outputs: Number(outputs),
          quality,
          aspect_ratio: ratio,
          model_name: selected.friendly_name,
          ...(referenceUrl ? { reference_image_url: referenceUrl } : {}),
        },
      })) as { generation_id: string; application_status: string };

      setResults((prev) =>
        prev.map((r) =>
          r.id === pendingId ? { ...r, id: res.generation_id, generationId: res.generation_id } : r,
        ),
      );

      if (res.application_status === "completed") {
        setStatus("Completed");
        await pollUntilDone(res.generation_id, meta);
      } else {
        setStatus("Generating");
        await pollUntilDone(res.generation_id, meta);
        setStatus("Completed");
      }
      await refreshWallet();
      await loadHistory();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Generation failed");
      setStatus(null);
      setResults((prev) => prev.filter((r) => r.id !== pendingId && r.status !== "generating"));
      await refreshWallet();
    } finally {
      setBusy(false);
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
          quality: shot.quality ?? quality,
          model_name: shot.modelName ?? selected?.friendly_name,
          model_id: shot.modelId ?? selected?.id,
          generation_id: shot.generationId,
          output_id: shot.outputId,
          settings: {
            media_type: "image",
            aspect_ratio: shot.aspectRatio ?? ratio,
            quality: shot.quality ?? quality,
            outputs: Number(outputs),
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
              Create Image
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
                  <Placeholder label="" className="thumb" variant="lime" />
                  <div>
                    <span>GENERAL</span>
                    <strong>{selected?.friendly_name ?? "Loading…"}</strong>
                    <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                      {selected
                        ? `${formatModelPriceLabel(selected)} · ${selected.quality_tier}`
                        : null}
                    </div>
                  </div>
                  <button type="button" className="change" onClick={() => setPicker(true)}>
                    Change
                  </button>
                </div>

                <div
                  className={`upload-box${referencePreview ? " has-file" : ""}`}
                  role="button"
                  tabIndex={0}
                  onClick={() => fileRef.current?.click()}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") fileRef.current?.click();
                  }}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.currentTarget.classList.add("drag");
                  }}
                  onDragLeave={(e) => e.currentTarget.classList.remove("drag")}
                  onDrop={(e) => {
                    e.preventDefault();
                    e.currentTarget.classList.remove("drag");
                    const file = e.dataTransfer.files?.[0];
                    if (file) onPickReference(file);
                  }}
                >
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/png,image/jpeg,image/jpg,image/webp"
                    hidden
                    onChange={(e) => onPickReference(e.target.files?.[0] ?? null)}
                  />
                  {referencePreview ? (
                    <div className="upload-preview" onClick={(e) => e.stopPropagation()}>
                      <img src={referencePreview} alt="Reference" />
                      <div className="upload-preview-actions">
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={() => fileRef.current?.click()}
                        >
                          Replace
                        </Button>
                        <Button type="button" variant="ghost" onClick={() => onPickReference(null)}>
                          Remove
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <strong>
                        Upload image or <em>generate it</em>
                      </strong>
                      <p>PNG or JPG · up to 10 MB · optional reference</p>
                    </>
                  )}
                </div>

                <div>
                  <div className="field-label">Prompt</div>
                  <textarea
                    className="textarea"
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder="Describe the scene you imagine, with details."
                  />
                </div>

                <div>
                  <div className="field-label">Aspect ratio</div>
                  <Segment
                    options={
                      selected?.supported_aspect_ratios?.length
                        ? selected.supported_aspect_ratios
                        : ["1:1", "4:5", "9:16", "16:9"]
                    }
                    value={ratio}
                    onChange={setRatio}
                  />
                </div>

                <div>
                  <div className="field-label">Quality</div>
                  <div className="settings-row">
                    {["Std", "HD", "Prem"].map((q) => (
                      <button
                        key={q}
                        type="button"
                        className={quality === q ? "active" : undefined}
                        onClick={() => {
                          setQuality(q);
                          setModelId(null);
                        }}
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="field-label">Outputs</div>
                  <div className="settings-row">
                    {["1", "2", "4"].map((n) => (
                      <button
                        key={n}
                        type="button"
                        className={outputs === n ? "active" : undefined}
                        onClick={() => setOutputs(n)}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="create-note">
                  Balance {credits} · After generation ~{Math.max(0, credits - totalCost)}
                  {status ? ` · ${status}` : ""}
                </div>
                {error ? <div className="field-error">{error}</div> : null}
              </div>

              <div className="create-panel-foot">
                <Button
                  variant="primary"
                  block
                  size="lg"
                  disabled={busy || !selected}
                  onClick={() => void onGenerate()}
                >
                  {busy ? "Generating…" : `Generate Image · ${totalCost} credits`}
                </Button>
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
                Saved generations with their prompt and settings. Click an item to reopen it.
              </p>
              {wishlist.length === 0 ? (
                <div className="wishlist-empty">
                  No wishlist items yet. Generate an image, then tap Wishlist on the result.
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
                        if (video) {
                          nav("/app/video");
                          return;
                        }
                        setMainTab("create");
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
                              quality: item.quality,
                              modelName: item.model_name,
                              modelId: item.model_id,
                            },
                            ...prev,
                          ];
                        });
                        setActiveId(item.output_id ?? item.id);
                        if (item.prompt) setPrompt(item.prompt);
                        if (item.aspect_ratio) setRatio(item.aspect_ratio);
                        if (item.quality) setQuality(item.quality);
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
                        {item.quality ? <span>{item.quality}</span> : null}
                      </div>
                      <div className="wishlist-actions">
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={() =>
                            void downloadImage(
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
            <button type="button" className="pill" onClick={() => void loadHistory()}>
              ◫ Refresh
            </button>
            <button type="button" className="pill" onClick={() => setMainTab("wishlist")}>
              ◫ Wishlist · {wishlist.length}
            </button>
          </div>

          {activeShot?.url ? (
            <div className="result-hero">
              <div className="result-frame">
                <img src={activeShot.url} alt="Generated result" />
              </div>
              <div className="result-meta">
                <div className="result-meta-copy">
                  <p>{activeShot.prompt}</p>
                  <div className="wishlist-tags">
                    {activeShot.modelName ? <span>{activeShot.modelName}</span> : null}
                    {activeShot.aspectRatio ? <span>{activeShot.aspectRatio}</span> : null}
                    {activeShot.quality ? <span>{activeShot.quality}</span> : null}
                  </div>
                </div>
                <div className="result-actions">
                  <button
                    type="button"
                    className="result-action"
                    onClick={() =>
                      void downloadImage(
                        activeShot.url!,
                        `dady-${(activeShot.id || "image").slice(0, 8)}.jpg`,
                      )
                    }
                  >
                    Download
                  </button>
                  <button
                    type="button"
                    className={`result-action${wishlistedUrls.has(activeShot.url) ? " on" : ""}`}
                    disabled={wishBusy}
                    onClick={() => void toggleWishlist(activeShot)}
                  >
                    {wishlistedUrls.has(activeShot.url) ? "Wishlisted" : "Wishlist"}
                  </button>
                  <a className="result-action" href={activeShot.url} target="_blank" rel="noreferrer">
                    Open full size
                  </a>
                </div>
              </div>
            </div>
          ) : (
            <div className="promo-strip">
              <div>
                <strong>Image Creator Pack</strong>
                <span>Festival creatives + product shots in one workspace</span>
              </div>
              <Button variant="lime" onClick={() => nav("/pricing")}>
                Upgrade plan
              </Button>
            </div>
          )}

          <div className="create-gallery">
            {historyLoading
              ? Array.from({ length: 6 }, (_, i) => (
                  <div key={`skel-${i}`} className="shot shot-skeleton" aria-hidden>
                    <div className="shot-skeleton-inner" />
                  </div>
                ))
              : results.length
              ? results.map((shot) => (
                  <button
                    key={shot.id}
                    type="button"
                    className={`shot result-shot${activeId === shot.id ? " active" : ""}`}
                    onClick={() => shot.url && setActiveId(shot.id)}
                    title={shot.prompt ?? shot.label}
                  >
                    {shot.url ? (
                      <>
                        <img src={shot.url} alt={shot.prompt ?? "Generated"} />
                        {wishlistedUrls.has(shot.url) ? <span className="wish-badge">♥</span> : null}
                      </>
                    ) : (
                      <div className="shot-pending">
                        <span className="spin" />
                        Generating…
                      </div>
                    )}
                  </button>
                ))
              : placeholderShots.map(([label, tone]) => (
                  <div key={label} className="shot">
                    <Placeholder label={label} variant={tone} />
                    <span className="play">▶</span>
                  </div>
                ))}
          </div>
        </main>
      </div>

      {picker ? (
        <div className="model-modal-backdrop" onClick={() => setPicker(false)}>
          <div className="model-modal" onClick={(e) => e.stopPropagation()}>
            <input
              placeholder="Search models…"
              value={modelSearch}
              onChange={(e) => setModelSearch(e.target.value)}
            />
            {filteredCatalog.map((m) => (
              <button
                key={m.id}
                type="button"
                className={`model-option${selected?.id === m.id ? " active" : ""}`}
                onClick={() => {
                  setModelId(m.id);
                  setPicker(false);
                }}
              >
                <strong>{m.friendly_name}</strong>
                <span>
                  {m.category} · {formatModelPriceLabel(m)}
                </span>
              </button>
            ))}
            {!filteredCatalog.length ? <p style={{ padding: 12 }}>No models match.</p> : null}
          </div>
        </div>
      ) : null}
    </>
  );
}
