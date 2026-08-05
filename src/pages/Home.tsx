import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AutoPlayVideo } from "../components/AutoPlayVideo";
import { Button, Chip } from "../components/ui";
import { useModels, useWallet } from "../hooks/useCatalog";
import { estimateJobCredits, formatModelPriceLabel } from "../lib/pricing/credits";
import { showcaseImages } from "../lib/showcaseImages";
import { viralPresets } from "../lib/viralPresets";
import "./Home.css";

const tools = [
  {
    title: "Reel Studio",
    desc: "9:16 video generations",
    tag: "Video",
    kind: "video" as const,
    mediaUrl: viralPresets[0].videoUrl,
    prompt: viralPresets[0].prompt,
  },
  {
    title: "Cinematic Pro",
    desc: "Film-grade motion",
    tag: "New",
    kind: "video" as const,
    mediaUrl: viralPresets[5].videoUrl,
    prompt: viralPresets[5].prompt,
  },
  {
    title: "Priority Queue",
    desc: "Faster job starts",
    tag: "",
    kind: "video" as const,
    mediaUrl: viralPresets[6].videoUrl,
    prompt: viralPresets[6].prompt,
  },
  {
    title: "Academy",
    desc: "Learn workflows fast",
    tag: "New",
    kind: "image" as const,
    mediaUrl: showcaseImages[1].imageUrl,
    prompt: showcaseImages[1].prompt,
  },
  {
    title: "Cinema Studio",
    desc: "Long-form scenes",
    tag: "Soon",
    kind: "video" as const,
    mediaUrl: viralPresets[7].videoUrl,
    prompt: viralPresets[7].prompt,
  },
  {
    title: "Brand Kit",
    desc: "Logo + colors locked",
    tag: "",
    kind: "image" as const,
    mediaUrl: showcaseImages[2].imageUrl,
    prompt: showcaseImages[2].prompt,
  },
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
  const [filter, setFilter] = useState<string>(viralPresets[0].label);
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
          {tools.map((t) => (
            <button
              key={t.title}
              type="button"
              className="tool-card"
              onClick={() =>
                nav(t.kind === "video" ? "/app/video" : "/app/create/image", {
                  state: { prompt: t.prompt },
                })
              }
            >
              {t.tag ? <span className="tool-tag">{t.tag}</span> : null}
              <div className="tool-thumb">
                {t.kind === "video" ? (
                  <AutoPlayVideo src={t.mediaUrl} className="tool-thumb-media" />
                ) : (
                  <img className="tool-thumb-media" src={t.mediaUrl} alt="" loading="lazy" />
                )}
              </div>
              <strong>{t.title}</strong>
              <span>{t.desc}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="presets-block">
        <div className="presets-head">
          <div>
            <h2>Creator presets</h2>
            <p>Ready-made looks for reels, ads and festivals — autoplaying previews.</p>
          </div>
          <Button variant="ghost" onClick={() => nav("/app/templates")}>
            View all ↗
          </Button>
        </div>

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
      </section>
    </div>
  );
}
