import { useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { MarketingHeader } from "../layouts/MarketingHeader";
import { Logo } from "../components/Logo";
import { AutoPlayVideo } from "../components/AutoPlayVideo";
import { Button, Chip, Placeholder } from "../components/ui";
import { usePlatformStats } from "../hooks/useCatalog";
import { showcaseImages } from "../lib/showcaseImages";
import { viralPresets, type ViralPresetLabel } from "../lib/viralPresets";
import "./Landing.css";

const collage = [
  { title: "Text to Video", meta: "AI-Powered", tone: "lime" as const },
  { title: "AI Image", meta: "From Text", tone: "pink" as const },
  { title: "Product Ads", meta: "AI Generated", tone: "blue" as const },
  {
    title: "AI Avatars",
    meta: "Realistic & Expressive",
    tone: "default" as const,
    imageUrl: "/brand/landing-ai-avatar-anime.png",
    launchingSoon: true,
  },
  {
    title: "AI Voiceover",
    meta: "Natural · 0:08",
    tone: "pink" as const,
    imageUrl: "/brand/landing-ai-voiceover-mic.png",
    launchingSoon: true,
  },
];

const features = [
  { icon: "◈", color: "var(--lime)", title: "Text to Image", desc: "Create stunning images from simple text prompts." },
  { icon: "▶", color: "var(--premium)", title: "Text to Video", desc: "Turn ideas into engaging videos in minutes." },
  { icon: "◎", color: "var(--warning)", title: "Product Ads", desc: "Generate high-converting ads for your products." },
  { icon: "☺", color: "var(--jade)", title: "AI Avatars", desc: "Create realistic AI avatars in any style." },
  { icon: "♪", color: "var(--premium)", title: "Voice & Audio", desc: "Natural voiceovers in 8 Indian languages." },
  { icon: "▤", color: "var(--blue)", title: "Templates", desc: "Festival, reel and brand packs ready to use." },
];

const footerLinks = [
  { label: "About", to: "/app" },
  { label: "Contact", to: "/app/help" },
  { label: "Pricing", to: "/pricing" },
  { label: "Image", to: "/app/create/image" },
  { label: "Video", to: "/app/video" },
] as const;

function formatCount(n: number) {
  if (!Number.isFinite(n) || n < 0) return "0";
  if (n < 1000) return String(Math.round(n));
  if (n < 1_000_000) {
    const v = n / 1000;
    return `${v >= 10 ? Math.round(v) : v.toFixed(1).replace(/\.0$/, "")}K`;
  }
  const v = n / 1_000_000;
  return `${v >= 10 ? Math.round(v) : v.toFixed(1).replace(/\.0$/, "")}M`;
}

function formatUptime(pct: number) {
  if (!Number.isFinite(pct)) return "100%";
  const clamped = Math.max(0, Math.min(100, pct));
  return `${Number.isInteger(clamped) ? clamped : clamped.toFixed(1)}%`;
}

export function Landing() {
  const nav = useNavigate();
  const { data: stats } = usePlatformStats();
  const [activePreset, setActivePreset] = useState<ViralPresetLabel>(viralPresets[0].label);
  const chipRowRef = useRef<HTMLDivElement>(null);
  const chipRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  const heroStats = [
    [formatCount(stats?.creators ?? 0), "Happy Creators"],
    [formatCount(stats?.generations ?? 0), "Generations"],
    [formatCount(stats?.models ?? 0), "AI Models"],
    [formatUptime(stats?.uptime_pct ?? 100), "Uptime"],
  ] as const;

  const scrollChips = (dir: -1 | 1) => {
    chipRowRef.current?.scrollBy({ left: dir * 220, behavior: "smooth" });
  };

  const selectPreset = (label: ViralPresetLabel) => {
    setActivePreset((prev) => {
      if (prev === label) return prev;
      return label;
    });
    const el = chipRefs.current[label];
    if (!el || !chipRowRef.current) return;
    const row = chipRowRef.current;
    const left = el.offsetLeft;
    const right = left + el.offsetWidth;
    if (left < row.scrollLeft || right > row.scrollLeft + row.clientWidth) {
      el.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
    }
  };

  return (
    <div className="landing">
      <MarketingHeader />

      <section className="hero-split animate-in">
        <div className="hero-split-copy">
          <div className="hero-badge">✦ India’s Most Powerful AI Creative Platform</div>
          <h1>
            Create. Imagine.
            <span>Make it Real.</span>
          </h1>
          <p>
            All-in-one AI platform to generate images, videos, ads, avatars and
            more — in just a few clicks.
          </p>
          <div className="hero-split-ctas">
            <Button size="lg" variant="lime" onClick={() => nav("/app")}>
              Start Creating
            </Button>
            <Button size="lg" variant="ghost" className="btn-outline-jade" onClick={() => nav("/app")}>
              Explore Features
            </Button>
          </div>

          <div className="hero-stats">
            {heroStats.map(([n, l]) => (
              <div key={l} className="hero-stat">
                <strong>{n}</strong>
                <span>{l}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="hero-collage animate-in-delay">
          <button
            type="button"
            className="collage-card collage-wide"
            onClick={() => nav("/app/video")}
          >
            <Placeholder label="" height="100%" variant="lime" />
            <div className="collage-meta">
              <strong>Text to Video</strong>
              <span>AI-Powered</span>
            </div>
            <span className="collage-play">▶</span>
          </button>
          {collage.slice(1).map((c) => (
            <button
              key={c.title}
              type="button"
              className={`collage-card${c.launchingSoon ? " is-soon" : ""}`}
              onClick={() => {
                if (c.launchingSoon) return;
                nav(
                  c.title.includes("Video") || c.title.includes("Voice")
                    ? "/app/video"
                    : "/app/create/image",
                );
              }}
            >
              {"imageUrl" in c && c.imageUrl ? (
                <img className="collage-media" src={c.imageUrl} alt={c.title} loading="lazy" />
              ) : (
                <Placeholder label="" height="100%" variant={c.tone} />
              )}
              {c.launchingSoon ? <span className="collage-soon">Launching soon</span> : null}
              <div className="collage-meta">
                <strong>{c.title}</strong>
                <span>{c.meta}</span>
              </div>
            </button>
          ))}
        </div>
      </section>

      <section className="feature-bar animate-in-delay-2">
        {features.map((f) => (
          <article key={f.title} className="feature-bar-item">
            <span className="feature-bar-icon" style={{ color: f.color }}>
              {f.icon}
            </span>
            <div>
              <strong>{f.title}</strong>
              <p>{f.desc}</p>
            </div>
          </article>
        ))}
      </section>

      {/* Dady's Viral Presets */}
      <section className="landing-section presets-section">
        <div className="landing-section-head">
          <h2>Dady’s Viral Presets</h2>
          <p>Big-budget visual effects, from explosions to surreal transformations.</p>
        </div>

        <div className="preset-chip-row-wrap">
          <div className="preset-chip-row" ref={chipRowRef}>
            {viralPresets.map((p) => (
              <Chip
                key={p.label}
                active={activePreset === p.label}
                onClick={() => selectPreset(p.label)}
                ref={(el) => {
                  chipRefs.current[p.label] = el;
                }}
              >
                {p.label.toUpperCase()}
              </Chip>
            ))}
          </div>
          <div className="preset-chip-nav">
            <button type="button" aria-label="Scroll left" onClick={() => scrollChips(-1)}>
              ‹
            </button>
            <button type="button" aria-label="Scroll right" onClick={() => scrollChips(1)}>
              ›
            </button>
          </div>
        </div>

        <div className="viral-preset-grid">
          {viralPresets.map((p) => (
            <button
              key={p.label}
              type="button"
              className={`viral-preset-card${activePreset === p.label ? " is-active" : ""}`}
              onMouseEnter={() => selectPreset(p.label)}
              onFocus={() => selectPreset(p.label)}
              onClick={() =>
                nav("/app/video", {
                  state: { prompt: p.prompt },
                })
              }
            >
              <AutoPlayVideo src={p.videoUrl} className="viral-preset-video" />
              <span className="viral-preset-label">{p.label}</span>
              <span className="viral-preset-play">▶</span>
            </button>
          ))}
        </div>

        <div className="landing-section-cta">
          <Button variant="lime" onClick={() => nav("/app/templates")}>
            View all presets ↗
          </Button>
        </div>
      </section>

      {/* GPT Image style showcase */}
      <section className="landing-section bento-section">
        <div className="landing-section-head">
          <h2>GPT Image 2</h2>
          <p>4K images with near-perfect text rendering.</p>
        </div>

        <div className="bento-grid">
          {showcaseImages.map((c) => (
            <button
              key={c.label}
              type="button"
              className={`bento-card bento-${c.area}`}
              onClick={() =>
                nav("/app/create/image", {
                  state: { prompt: c.prompt },
                })
              }
            >
              <img
                className="bento-media"
                src={c.imageUrl}
                alt={c.label}
                loading="lazy"
                decoding="async"
              />
              <span className="bento-label">{c.label}</span>
            </button>
          ))}
        </div>

        <div className="landing-section-cta">
          <Button variant="lime" onClick={() => nav("/app/create/image")}>
            View all of GPT Image 2 ↗
          </Button>
        </div>
      </section>

      {/* Footer directory */}
      <section className="site-directory">
        <div className="site-directory-inner">
          <div className="site-directory-layout">
            <div className="site-directory-copy">
              <h2>
                The ultimate AI-powered camera control for filmmakers &amp; creators
                <em className="site-directory-new">NEW!</em>
              </h2>
              <div className="site-directory-brand">
                <Logo variant="hero" to="/" className="site-directory-logo" />
                <nav className="site-directory-nav" aria-label="Footer">
                  {footerLinks.map((item) => (
                    <Link key={item.label} to={item.to}>
                      {item.label}
                    </Link>
                  ))}
                </nav>
              </div>
            </div>

            <div className="site-directory-media">
              <AutoPlayVideo
                className="site-directory-video"
                src="/brand/camera-control-preview.mp4"
              />
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
