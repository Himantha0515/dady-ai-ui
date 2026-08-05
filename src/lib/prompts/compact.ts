/** Hailuo and many fal video models reject prompts over ~2000 chars. */
export function maxPromptCharsForVideoModel(model: {
  provider_model_id?: string | null;
  friendly_name?: string | null;
  configuration?: unknown;
} | null | undefined): number {
  const cfg =
    model?.configuration && typeof model.configuration === "object"
      ? (model.configuration as Record<string, unknown>)
      : null;
  const endpoint =
    (typeof cfg?.fal_endpoint === "string" ? cfg.fal_endpoint : null) ||
    model?.provider_model_id ||
    "";
  const name = model?.friendly_name || "";
  if (/hailuo|minimax/i.test(endpoint) || /hailuo/i.test(name)) return 2000;
  return 2500;
}

/** Prefer FINAL_VIDEO_PROMPT when a long STYLE_LOCK template exceeds the provider limit. */
export function compactPromptForProvider(prompt: string, maxChars: number): {
  prompt: string;
  compacted: boolean;
} {
  if (prompt.length <= maxChars) return { prompt, compacted: false };
  const triple = prompt.match(/FINAL_VIDEO_PROMPT\s*=\s*"""([\s\S]*?)"""/i);
  const fromTriple = triple?.[1]?.trim();
  if (fromTriple && fromTriple.length <= maxChars) {
    return { prompt: fromTriple, compacted: true };
  }
  const single = prompt.match(/FINAL_VIDEO_PROMPT\s*=\s*"([\s\S]*?)"/i);
  const fromSingle = single?.[1]?.trim();
  if (fromSingle && fromSingle.length <= maxChars) {
    return { prompt: fromSingle, compacted: true };
  }
  return { prompt: prompt.slice(0, maxChars), compacted: true };
}
