import { GenerationsGallery } from "../components/GenerationsGallery";

/** Shared gallery of successful image + video generations for every signed-in user. */
export function Templates() {
  return (
    <GenerationsGallery
      title="Templates"
      description="All of your successfully generated images and videos — with previews, prompts, and model details."
      emptyCta="Generate your first image"
    />
  );
}
