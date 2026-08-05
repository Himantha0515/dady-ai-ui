import type { WishlistItem } from "./api/catalog";

/** Wishlists store media in `image_url` for both images and videos. */
export function isWishlistVideo(item: Pick<WishlistItem, "image_url" | "settings">): boolean {
  const settings = (item.settings ?? {}) as Record<string, unknown>;
  if (settings.media_type === "video") return true;
  if (settings.media_type === "image") return false;
  return /\.(mp4|webm|mov)(\?|$)/i.test(item.image_url);
}
