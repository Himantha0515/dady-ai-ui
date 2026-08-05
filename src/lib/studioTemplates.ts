import { showcaseImages } from "./showcaseImages";
import { viralPresets } from "./viralPresets";

/** Empty-state gallery templates for Image Studio. */
export const imageStudioTemplates = [
  {
    label: "Studio mug",
    imageUrl:
      "https://v3b.fal.media/files/b/0aa51c9b/QPIHeCuBF2j9uhdmh5093_6d4885a499e749ef9b46bf288c880707.jpg",
    prompt: "Ceramic coffee mug on marble, soft window light, shallow depth of field, product photo",
  },
  {
    label: "Kurta flat-lay",
    imageUrl: showcaseImages[2].imageUrl,
    prompt: "Flat-lay of an Indian kurta on linen, soft daylight, fashion catalog style",
  },
  {
    label: "Storefront",
    imageUrl: showcaseImages[1].imageUrl,
    prompt: showcaseImages[1].prompt,
  },
  {
    label: "Festival poster",
    imageUrl:
      "https://v3b.fal.media/files/b/0aa52b62/1iAhRqIDFv9gXxFc3MErx.jpg",
    prompt: "Vertical festival invitation poster, bold typography space, vibrant design",
  },
  {
    label: "Avatar look",
    imageUrl: showcaseImages[0].imageUrl,
    prompt: showcaseImages[0].prompt,
  },
  {
    label: "Banner wide",
    imageUrl: showcaseImages[3].imageUrl,
    prompt: showcaseImages[3].prompt,
  },
] as const;

/** Empty-state gallery templates for Video Studio (autoplay). */
export const videoStudioTemplates = [
  {
    label: "Cafe reel",
    videoUrl: viralPresets[4].videoUrl,
    prompt: viralPresets[4].prompt,
  },
  {
    label: "Product push-in",
    videoUrl: viralPresets[2].videoUrl,
    prompt: viralPresets[2].prompt,
  },
  {
    label: "Street night",
    videoUrl: viralPresets[1].videoUrl,
    prompt: viralPresets[1].prompt,
  },
  {
    label: "Festival burst",
    videoUrl: viralPresets[0].videoUrl,
    prompt: viralPresets[0].prompt,
  },
  {
    label: "Avatar talk",
    videoUrl: viralPresets[7].videoUrl,
    prompt: viralPresets[7].prompt,
  },
  {
    label: "Store teaser",
    videoUrl: viralPresets[5].videoUrl,
    prompt: viralPresets[5].prompt,
  },
] as const;
