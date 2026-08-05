import { useEffect, useRef } from "react";

type Props = {
  src: string;
  className?: string;
  /** Show native controls (hero). Gallery usually false. */
  controls?: boolean;
  poster?: string;
};

/**
 * Muted looping autoplay that prefers playing while in (or near) the viewport.
 * Tuned for iOS/Android: muted + playsInline + explicit play() retries.
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

    const tryPlay = () => {
      if (!alive) return;
      el.muted = true;
      const p = el.play();
      if (p && typeof p.catch === "function") p.catch(() => undefined);
    };

    const onReady = () => tryPlay();
    el.addEventListener("loadeddata", onReady);
    el.addEventListener("canplay", onReady);
    el.addEventListener("loadedmetadata", onReady);

    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry) return;
        if (entry.isIntersecting) {
          tryPlay();
        } else {
          el.pause();
        }
      },
      { threshold: [0, 0.08, 0.25], rootMargin: "120px 0px" },
    );

    io.observe(el);
    tryPlay();

    const onVis = () => {
      if (document.visibilityState === "visible") tryPlay();
    };
    document.addEventListener("visibilitychange", onVis);

    return () => {
      alive = false;
      io.disconnect();
      el.removeEventListener("loadeddata", onReady);
      el.removeEventListener("canplay", onReady);
      el.removeEventListener("loadedmetadata", onReady);
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
