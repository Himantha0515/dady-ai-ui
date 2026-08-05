export const viralPresets = [
  { label: "Earth Zoom", tone: "lime" as const },
  { label: "Mighty Fighter", tone: "pink" as const },
  { label: "Fairytale Castle", tone: "blue" as const },
  { label: "Moonwalk", tone: "default" as const },
  { label: "Sketch to Fabric", tone: "lime" as const },
  { label: "Float Spin", tone: "pink" as const },
  { label: "Sticker Peel", tone: "blue" as const },
  { label: "Selfie Twin", tone: "default" as const },
] as const;

export type ViralPresetLabel = (typeof viralPresets)[number]["label"];
