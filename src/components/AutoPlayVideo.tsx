import { useEffect, useRef } from "react";

type Props = {
  src: string;
  className?: string;
  /** Show native controls (hero). Gallery usually false. */
  controls?: boolean;
  poster?: string;
};

/** All mounted muted videos — keep them looping even when many are on screen. */
const registry = new Set<HTMLVideoElement>();
let kickTimer: number | null = null;

function ensureKickLoop() {
  if (typeof window === "undefined" || kickTimer != null) return;
  kickTimer = window.setInterval(() => {
    if (document.visibilityState !== "visible") return;
    for (const el of registry) {
      if (el.paused || el.ended) {
        el.muted = true;
        const p = el.play();
        if (p && typeof p.catch === "function") p.catch(() => undefined);
      }
    }
  }, 900);
}

function register(el: HTMLVideoElement) {
  registry.add(el);
  ensureKickLoop();
}

function unregister(el: HTMLVideoElement) {
  registry.delete(el);
  if (registry.size === 0 && kickTimer != null) {
    window.clearInterval(kickTimer);
    kickTimer = null;
  }
}

/**
 * Muted looping autoplay for every mounted clip.
 * Does not pause on scroll (that caused only 2–3 videos to play on mobile).
 * Retries play while the tab is visible so clips keep running continuously.
 */
export function AutoPlayVideo({ src, className, controls = false, poster }: Props) {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    el.muted = true;
    el.defaultMuted = true;
    el.playsInline = true;
    el.setAttribute("muted", "");
    el.setAttribute("playsinline", "");
    el.setAttribute("webkit-playsinline", "");

    let alive = true;
    let resumeTimer: number | null = null;

    const tryPlay = () => {
      if (!alive || document.visibilityState !== "visible") return;
      el.muted = true;
      const p = el.play();
      if (p && typeof p.catch === "function") p.catch(() => undefined);
    };

    register(el);

    const onReady = () => tryPlay();
    const onPause = () => {
      if (!alive || document.visibilityState !== "visible") return;
      if (resumeTimer != null) window.clearTimeout(resumeTimer);
      resumeTimer = window.setTimeout(tryPlay, 120);
    };

    el.addEventListener("loadeddata", onReady);
    el.addEventListener("canplay", onReady);
    el.addEventListener("playing", onReady);
    el.addEventListener("pause", onPause);

    const onVis = () => {
      if (document.visibilityState === "visible") tryPlay();
      else el.pause();
    };
    document.addEventListener("visibilitychange", onVis);

    // Stagger start slightly so many clips don't contend on the same tick.
    const delay = Math.floor(Math.random() * 280);
    const startId = window.setTimeout(tryPlay, delay);

    return () => {
      alive = false;
      window.clearTimeout(startId);
      if (resumeTimer != null) window.clearTimeout(resumeTimer);
      unregister(el);
      el.removeEventListener("loadeddata", onReady);
      el.removeEventListener("canplay", onReady);
      el.removeEventListener("playing", onReady);
      el.removeEventListener("pause", onPause);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [src]);

  return (
    <video
      ref={ref}
      className={className}
      src={src}
      poster={poster}
      muted
      loop
      playsInline
      autoPlay
      controls={controls}
      preload="auto"
      disableRemotePlayback
    />
  );
}
