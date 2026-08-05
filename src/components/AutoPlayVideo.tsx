import { useEffect, useRef } from "react";

type Props = {
  src: string;
  className?: string;
  /** Show native controls (hero). Gallery usually false. */
  controls?: boolean;
  poster?: string;
};

/**
 * Muted looping autoplay that only runs while in (or near) the viewport —
 * keeps scroll smooth when many clips are on screen.
 */
export function AutoPlayVideo({ src, className, controls = false, poster }: Props) {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const tryPlay = () => {
      const p = el.play();
      if (p && typeof p.catch === "function") p.catch(() => undefined);
    };

    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry) return;
        if (entry.isIntersecting && entry.intersectionRatio >= 0.35) {
          tryPlay();
        } else {
          el.pause();
        }
      },
      { threshold: [0, 0.35, 0.7], rootMargin: "80px 0px" },
    );

    io.observe(el);
    return () => io.disconnect();
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
      preload="metadata"
      disableRemotePlayback
    />
  );
}
