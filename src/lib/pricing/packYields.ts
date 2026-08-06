/** Reference yields shown on Pricing cards (credits ÷ typical job cost). */
export const YIELD_COSTS = {
  seedance15ProVideo: 59, // Seedance 1.5 Pro · flat per clip
  hailuo5sVideo: 40, // Hailuo 02 Standard · 5s @ 768p (8 cr/s)
  hdImage: 5, // FLUX Dev / typical HD image
} as const;

export function packYields(credits: number) {
  const c = Math.max(0, Math.floor(credits));
  return {
    seedanceVideos: Math.floor(c / YIELD_COSTS.seedance15ProVideo),
    hailuoVideos: Math.floor(c / YIELD_COSTS.hailuo5sVideo),
    images: Math.floor(c / YIELD_COSTS.hdImage),
  };
}

export function formatPackYieldLines(credits: number): string[] {
  const y = packYields(credits);
  return [
    `≈ ${y.seedanceVideos} Seedance 1.5 Pro video${y.seedanceVideos === 1 ? "" : "s"}`,
    `≈ ${y.hailuoVideos} Hailuo video${y.hailuoVideos === 1 ? "" : "s"} (5s)`,
    `≈ ${y.images} HD image${y.images === 1 ? "" : "s"}`,
  ];
}
