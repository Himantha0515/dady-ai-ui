import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AutoPlayVideo } from "../components/AutoPlayVideo";
import { Button, Chip, Placeholder } from "../components/ui";
import { useModels, useWallet } from "../hooks/useCatalog";
import { generationsApi } from "../lib/api/catalog";
import { estimateJobCredits, formatModelPriceLabel } from "../lib/pricing/credits";
import { viralPresets } from "../lib/viralPresets";
import "./Home.css";

type BestVideo = {
  id: string;
  label: string;
  url: string;
  prompt: string | null;
  modelName: string | null;
  aspectRatio: string | null;
  duration: string | null;
  creditsCharged: number;
  createdAt: string;
};

function shortPresetLabel(prompt: string | null, modelName: string | null, index: number): string {
  const fromPrompt = (prompt || "").replace(/\s+/g, " ").trim();
  if (fromPrompt.length >= 4) {
    const words = fromPrompt.split(" ").slice(0, 3).join(" ");
    return words.length > 22 ? `${words.slice(0, 20)}…` : words;
  }
  return modelName || `Clip ${index + 1}`;
}

/**
 * Pinned Creator presets (best-first order):
 * 1) Anime Seedance action  2) Ice-climber LongCat POV
 */
const PINNED_BEST_VIDEO_IDS = [
  "8e83927b-be30-46d7-9736-fd9c2fdd13c3",
  "8fe7a519-3b85-4d20-ab0f-0324bbc69f17",
] as const;

const tools = [
  { title: "Reel Studio", desc: "9:16 video generations", tag: "Video", tone: "blue" as const },
  { title: "Cinematic Pro", desc: "Film-grade motion", tag: "New", tone: "lime" as const },
  { title: "Priority Queue", desc: "Faster job starts", tag: "", tone: "default" as const },
  { title: "Academy", desc: "Learn workflows fast", tag: "New", tone: "pink" as const },
  { title: "Cinema Studio", desc: "Long-form scenes", tag: "Soon", tone: "blue" as const },
  { title: "Brand Kit", desc: "Logo + colors locked", tag: "", tone: "default" as const },
];

const suggestionPools = [
  [
    "Create an anime short film",
    "Create a World Cup ad",
    "Create a Viking film trailer",
  ],
  [
    "Make a 15s product launch reel",
    "Create a Diwali festival promo",
    "Generate a cinematic cafe scene",
  ],
  [
    "Create a fashion lookbook clip",
    "Make a cricket match highlight ad",
    "Create a neon cyberpunk trailer",
  ],
];

const typingPrompts = [
  "Make a 30-second ad for my product…",
  "Create an anime short film with soft lighting…",
  "Create a World Cup ad for my brand…",
  "Create a Viking film trailer in cinematic style…",
  "Make a Diwali festival promo in Hindi…",
];

const durations = ["5s", "10s", "15s"] as const;
const ratios = ["9:16", "16:9", "1:1", "4:5"];

function durationSeconds(duration: string) {
  const n = Number.parseInt(duration, 10);
  return Number.isFinite(n) && n > 0 ? n : 5;
}

export function Home() {
  const nav = useNavigate();
  const { credits } = useWallet();
  const { data: videoModels = [] } = useModels("video");
  const [filter, setFilter] = useState<string>("");
  const [bestVideos, setBestVideos] = useState<BestVideo[]>([]);
  const [bestLoading, setBestLoading] = useState(true);
  const [workflowThumbs, setWorkflowThumbs] = useState<string[]>([]);
  const [prompt, setPrompt] = useState("");
  const [poolIdx, setPoolIdx] = useState(0);
  const [modelId, setModelId] = useState<string | null>(null);
  const [duration, setDuration] = useState<(typeof durations)[number]>("10s");
  const [ratio, setRatio] = useState("9:16");
  const [typedPlaceholder, setTypedPlaceholder] = useState("");
  const [typingPaused, setTypingPaused] = useState(false);

  const selectedModel = useMemo(() => {
    if (modelId) return videoModels.find((m) => m.id === modelId) ?? videoModels[0];
    return videoModels[0];
  }, [modelId, videoModels]);

  const suggestions = suggestionPools[poolIdx % suggestionPools.length];
  const creditCost = selectedModel
    ? estimateJobCredits(selectedModel, { durationSeconds: durationSeconds(duration) })
    : 10;
  const showTyping = prompt.length === 0 && !typingPaused;

  // Best 8 successful videos from Templates (highest credit / quality first).
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setBestLoading(true);
      try {
        const rows = (await generationsApi.listRecent(48, "video")) as Array<{
          id: string;
          prompt: string | null;
          application_status: string;
          credits_charged?: number | null;
          created_at: string;
          input_configuration?: Record<string, unknown> | null;
          model_catalog?: { friendly_name?: string; quality_tier?: string } | null;
          generation_outputs?: Array<{
            original_provider_url: string | null;
            mime_type?: string | null;
          }>;
        }>;

        const tierScore = (tier?: string | null) => {
          const t = (tier || "").toLowerCase();
          if (t === "cinematic" || t === "premium") return 4;
          if (t === "hd") return 3;
          if (t === "standard") return 2;
          if (t === "fast") return 1;
          return 0;
        };

        const mapped: BestVideo[] = [];
        const seen = new Set<string>();
        for (const row of rows) {
          if (row.application_status !== "completed") continue;
          const url = (row.generation_outputs ?? []).find((o) => o.original_provider_url)
            ?.original_provider_url;
          if (!url || seen.has(url)) continue;
          seen.add(url);
          const cfg = row.input_configuration ?? {};
          mapped.push({
            id: row.id,
            label: "",
            url,
            prompt: row.prompt,
            modelName: row.model_catalog?.friendly_name ?? null,
            aspectRatio: typeof cfg.aspect_ratio === "string" ? cfg.aspect_ratio : null,
            duration:
              typeof cfg.duration === "string"
                ? cfg.duration
                : typeof cfg.duration_seconds === "number"
                ? `${cfg.duration_seconds}s`
                : null,
            creditsCharged: Number(row.credits_charged ?? 0),
            createdAt: row.created_at,
          });
        }

        mapped.sort((a, b) => {
          if (b.creditsCharged !== a.creditsCharged) return b.creditsCharged - a.creditsCharged;
          const rowA = rows.find((r) => r.id === a.id);
          const rowB = rows.find((r) => r.id === b.id);
          const ta = tierScore(rowA?.model_catalog?.quality_tier);
          const tb = tierScore(rowB?.model_catalog?.quality_tier);
          if (tb !== ta) return tb - ta;
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        });

        // Pin selected clips into slots 1 & 2 (fetch if missing from recent list).
        const byId = new Map(mapped.map((v) => [v.id, v]));
        const pinned: BestVideo[] = [];
        for (const pinId of PINNED_BEST_VIDEO_IDS) {
          let clip = byId.get(pinId);
          if (!clip) {
            try {
              const pinRow = (await generationsApi.get(pinId)) as {
                id: string;
                prompt: string | null;
                application_status: string;
                credits_charged?: number | null;
                created_at: string;
                input_configuration?: Record<string, unknown> | null;
              };
              const outs = await generationsApi.listOutputs(pinId);
              const url = outs.find((o) => o.original_provider_url)?.original_provider_url;
              if (url && pinRow.application_status === "completed") {
                const cfg = pinRow.input_configuration ?? {};
                clip = {
                  id: pinRow.id,
                  label: "",
                  url,
                  prompt: pinRow.prompt,
                  modelName: null,
                  aspectRatio: typeof cfg.aspect_ratio === "string" ? cfg.aspect_ratio : "9:16",
                  duration:
                    typeof cfg.duration === "string"
                      ? cfg.duration
                      : typeof cfg.duration_seconds === "number"
                      ? `${cfg.duration_seconds}s`
                      : "5s",
                  creditsCharged: Number(pinRow.credits_charged ?? 0),
                  createdAt: pinRow.created_at,
                };
              }
            } catch {
              /* pinned fetch is best-effort */
            }
          }
          if (clip) pinned.push(clip);
        }
        const pinnedIds = new Set(pinned.map((v) => v.id));
        const ordered = [...pinned, ...mapped.filter((v) => !pinnedIds.has(v.id))];

        const top = ordered.slice(0, 8).map((v, i) => ({
          ...v,
          label: shortPresetLabel(v.prompt, v.modelName, i),
        }));

        // Recent image thumbs for Create workflows cards.
        const imageRows = (await generationsApi.listRecent(24, "image")) as Array<{
          application_status: string;
          generation_outputs?: Array<{ original_provider_url: string | null; mime_type?: string | null }>;
        }>;
        const thumbs: string[] = [];
        for (const row of imageRows) {
          if (row.application_status !== "completed") continue;
          for (const o of row.generation_outputs ?? []) {
            const u = o.original_provider_url;
            if (!u) continue;
            const mime = (o.mime_type || "").toLowerCase();
            if (mime.startsWith("video/") || /\.(mp4|webm|mov)(\?|$)/i.test(u)) continue;
            if (thumbs.includes(u)) continue;
            thumbs.push(u);
            if (thumbs.length >= tools.length) break;
          }
          if (thumbs.length >= tools.length) break;
        }

        if (!cancelled) {
          setBestVideos(top);
          setFilter(top[0]?.id ?? "");
          setWorkflowThumbs(thumbs);
        }
      } catch {
        if (!cancelled) {
          setBestVideos([]);
          setWorkflowThumbs([]);
        }
      } finally {
        if (!cancelled) setBestLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!showTyping) return;

    let cancelled = false;
    let promptIndex = 0;
    let charIndex = 0;
    let deleting = false;
    let timer: number | undefined;

    const tick = () => {
      if (cancelled) return;
      const full = typingPrompts[promptIndex % typingPrompts.length];

      if (!deleting) {
        charIndex += 1;
        setTypedPlaceholder(full.slice(0, charIndex));
        if (charIndex >= full.length) {
          deleting = true;
          timer = window.setTimeout(tick, 1600);
          return;
        }
        timer = window.setTimeout(tick, 38 + Math.random() * 28);
        return;
      }

      charIndex -= 1;
      setTypedPlaceholder(full.slice(0, Math.max(0, charIndex)));
      if (charIndex <= 0) {
        deleting = false;
        promptIndex = (promptIndex + 1) % typingPrompts.length;
        timer = window.setTimeout(tick, 420);
        return;
      }
      timer = window.setTimeout(tick, 18);
    };

    timer = window.setTimeout(tick, 350);
    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
    };
  }, [showTyping]);

  const applySuggestion = (text: string) => {
    setPrompt(text);
    setTypingPaused(false);
  };

  const refreshSuggestions = () => {
    setPoolIdx((i) => (i + 1) % suggestionPools.length);
  };

  const onGenerate = () => {
    const trimmed = prompt.trim();
    if (!trimmed) return;
    nav("/app/video", {
      state: {
        prompt: trimmed,
        modelName: selectedModel?.friendly_name,
        modelId: selectedModel?.id,
        duration,
        ratio,
        creditCost,
      },
    });
  };

  return (
    <div className="home app-main">
      <section className="vibe-composer vibe-composer--full animate-in">
        <div className="vibe-composer-head">
          <h2>Vibe Direct Your Next Video</h2>
          <p>Create videos by chatting with AI.</p>
        </div>

        <div className="vibe-prompt-shell">
          <button
            type="button"
            className="vibe-add"
            aria-label="Add reference"
            onClick={() => nav("/app/video")}
          >
            +
          </button>
          <div className="vibe-prompt-wrap">
            {showTyping ? (
              <div className="vibe-typing" aria-hidden>
                {typedPlaceholder}
                <span className="vibe-caret" />
              </div>
            ) : null}
            <textarea
              className="vibe-prompt"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onFocus={() => setTypingPaused(true)}
              onBlur={() => {
                if (!prompt.trim()) setTypingPaused(false);
              }}
              placeholder=""
              rows={3}
              aria-label="Video prompt"
            />
          </div>
          <div className="vibe-prompt-actions">
            <button
              type="button"
              className="vibe-send"
              disabled={!prompt.trim()}
              onClick={onGenerate}
              aria-label="Generate video"
            >
              ↑
            </button>
          </div>
        </div>

        <div className="vibe-suggestions">
          {suggestions.map((s) => (
            <button
              key={s}
              type="button"
              className="vibe-chip"
              onClick={() => applySuggestion(s)}
            >
              {s}
              <span aria-hidden>↖</span>
            </button>
          ))}
          <button
            type="button"
            className="vibe-refresh"
            onClick={refreshSuggestions}
            aria-label="Refresh suggestions"
            title="Refresh suggestions"
          >
            ↻
          </button>
        </div>

        <div className="vibe-controls">
          <label className="vibe-field">
            <span>Model</span>
            <select
              value={selectedModel?.id ?? ""}
              onChange={(e) => setModelId(e.target.value || null)}
            >
              {videoModels.length === 0 ? (
                <option value="">Loading models…</option>
              ) : (
                videoModels.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.friendly_name} · {formatModelPriceLabel(m, durationSeconds(duration))}
                  </option>
                ))
              )}
            </select>
          </label>

          <label className="vibe-field">
            <span>Duration</span>
            <div className="vibe-seg">
              {durations.map((d) => (
                <button
                  key={d}
                  type="button"
                  className={duration === d ? "active" : undefined}
                  onClick={() => setDuration(d)}
                  title={
                    selectedModel
                      ? `${estimateJobCredits(selectedModel, {
                          durationSeconds: durationSeconds(d),
                        })} credits`
                      : undefined
                  }
                >
                  {d}
                </button>
              ))}
            </div>
          </label>

          <label className="vibe-field">
            <span>Aspect ratio</span>
            <div className="vibe-seg">
              {ratios.map((r) => (
                <button
                  key={r}
                  type="button"
                  className={ratio === r ? "active" : undefined}
                  onClick={() => setRatio(r)}
                >
                  {r}
                </button>
              ))}
            </div>
          </label>
        </div>

        <div className="vibe-footer">
          <div className="vibe-meta">
            <span>{selectedModel?.friendly_name ?? "Video model"}</span>
            <span>·</span>
            <span>{duration}</span>
            <span>·</span>
            <span>{ratio}</span>
            <span>·</span>
            <span>Balance {credits}</span>
          </div>
          <Button
            variant="lime"
            size="lg"
            disabled={!prompt.trim()}
            onClick={onGenerate}
          >
            Generate · {creditCost} credits
          </Button>
        </div>
      </section>

      <section className="home-tools">
        <div className="home-section-head">
          <h2>Create workflows</h2>
          <p>Start from the outcome you want — not a model name.</p>
        </div>
        <div className="tools-grid">
          {tools.map((t, i) => {
            const thumb = workflowThumbs[i] ?? null;
            return (
              <button
                key={t.title}
                type="button"
                className="tool-card"
                onClick={() =>
                  nav(
                    t.title.includes("Cinema") ||
                      t.title.includes("Reel") ||
                      t.title.includes("Cinematic") ||
                      t.title.includes("Queue")
                      ? "/app/video"
                      : "/app/create/image",
                  )
                }
              >
                {t.tag ? <span className="tool-tag">{t.tag}</span> : null}
                <div className="tool-thumb">
                  {thumb ? (
                    <img src={thumb} alt="" loading="lazy" />
                  ) : (
                    <Placeholder label="" height={72} variant={t.tone} style={{ borderRadius: 14 }} />
                  )}
                </div>
                <strong>{t.title}</strong>
                <span>{t.desc}</span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="presets-block">
        <div className="presets-head">
          <div>
            <h2>Creator presets</h2>
            <p>
              {bestVideos.length
                ? "Your best 8 generated videos — highest quality first."
                : "Ready-made looks for reels, ads and festivals."}
            </p>
          </div>
          <Button variant="ghost" onClick={() => nav("/app/templates")}>
            View all ↗
          </Button>
        </div>

        {bestLoading ? (
          <div className="preset-grid">
            {Array.from({ length: 8 }, (_, i) => (
              <div key={`skel-${i}`} className="preset-card preset-card-skel" aria-hidden>
                <div className="preset-skel-inner" />
              </div>
            ))}
          </div>
        ) : bestVideos.length > 0 ? (
          <>
            <div className="preset-filters">
              {bestVideos.map((v) => (
                <Chip
                  key={v.id}
                  active={filter === v.id}
                  onClick={() => setFilter(v.id)}
                >
                  {v.label}
                </Chip>
              ))}
            </div>
            <div className="preset-grid">
              {bestVideos.map((v) => (
                <button
                  key={v.id}
                  type="button"
                  className={`preset-card${filter === v.id ? " is-active" : ""}`}
                  onMouseEnter={() => setFilter(v.id)}
                  onFocus={() => setFilter(v.id)}
                  onClick={() =>
                    nav("/app/video", {
                      state: {
                        prompt: v.prompt || undefined,
                        modelName: v.modelName || undefined,
                        duration: v.duration || undefined,
                        ratio: v.aspectRatio || undefined,
                      },
                    })
                  }
                >
                  <AutoPlayVideo src={v.url} className="preset-media-video" />
                  <span className="preset-label">{v.label}</span>
                  <span className="preset-meta">{v.modelName || "Video"}</span>
                </button>
              ))}
            </div>
          </>
        ) : (
          <>
            <div className="preset-filters">
              {viralPresets.map((p) => (
                <Chip
                  key={p.label}
                  active={filter === p.label}
                  onClick={() => setFilter(p.label)}
                >
                  {p.label}
                </Chip>
              ))}
            </div>
            <div className="preset-grid">
              {viralPresets.map((p) => (
                <button
                  key={p.label}
                  type="button"
                  className={`preset-card${filter === p.label ? " is-active" : ""}`}
                  onMouseEnter={() => setFilter(p.label)}
                  onFocus={() => setFilter(p.label)}
                  onClick={() =>
                    nav("/app/video", {
                      state: { prompt: p.prompt },
                    })
                  }
                >
                  <AutoPlayVideo src={p.videoUrl} className="preset-media-video" />
                  <span className="preset-label">{p.label}</span>
                  <span className="preset-play">▶</span>
                </button>
              ))}
            </div>
          </>
        )}
      </section>
    </div>
  );
}
