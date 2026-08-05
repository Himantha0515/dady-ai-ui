/**
 * Landing “Viral Presets” — real completed videos (autoplay).
 * Includes 7 clips generated after 4:00 AM IST on 6 Aug 2026 + the anime showcase.
 */
export const viralPresets = [
  {
    label: "Soccer Sprint",
    tone: "lime" as const,
    prompt:
      "A woman in a red and yellow soccer jersey numbered 7 sprints across a floodlit stadium pitch",
    videoUrl: "https://v3b.fal.media/files/b/0aa52cb6/Eek9d6liADggZGLoTPCEp_video.mp4",
  },
  {
    label: "Skate Park",
    tone: "pink" as const,
    prompt:
      "A young skateboarder in a black t-shirt and baggy jeans performs tricks at a brutalist skate park",
    videoUrl: "https://v3b.fal.media/files/b/0aa52cbb/xOv9pZhlX1OmIeLRaVbq2_video.mp4",
  },
  {
    label: "Navy Suit",
    tone: "blue" as const,
    prompt:
      "A man in a tailored navy blue suit washes his hands in a sleek modern bathroom, cinematic lighting",
    videoUrl: "https://v3b.fal.media/files/b/0aa52c98/K6WQC2P2bKncQPvmX60f9_video.mp4",
  },
  {
    label: "Cat Warrior",
    tone: "default" as const,
    prompt:
      "An anthropomorphic orange tabby cat warrior in green leather armor dashes across a fantasy battlefield",
    videoUrl: "https://v3b.fal.media/files/b/0aa52c8a/cO0Ha19Zy2Hwi42bIYpH8_video.mp4",
  },
  {
    label: "Chocolate Ad",
    tone: "lime" as const,
    prompt:
      "Chocolate japanese style commercial, with chocolate crunching, pieces breaking, ultra close-up",
    videoUrl: "https://v3b.fal.media/files/b/0aa52c75/HHJQcICaWcJiOOJ3x0pSC_video.mp4",
  },
  {
    label: "Blockbuster",
    tone: "pink" as const,
    prompt:
      "Ultra-premium anamorphic blockbuster cinematography, wide lens for scale, occasional close-ups",
    videoUrl: "https://v3b.fal.media/files/b/0aa52c5c/Lcj3yokoo3ZRdB9eV7Q_p_video.mp4",
  },
  {
    label: "Light Mage",
    tone: "blue" as const,
    prompt:
      "First-person POV of a light mage summoning a golden energy orb between outstretched hands",
    videoUrl: "https://v3b.fal.media/files/b/0aa52c39/BSFdNfOs4rgdTmUpHVsp6_video.mp4",
  },
  {
    label: "Anime Action",
    tone: "default" as const,
    prompt:
      "Create an eight-second cinematic 2D cel-shaded anime action sequence using every Seedance strength",
    videoUrl: "https://v3b.fal.media/files/b/0aa5231f/imjm7Av1dGYX9afmXhN7z_video.mp4",
  },
] as const;

export type ViralPresetLabel = (typeof viralPresets)[number]["label"];
