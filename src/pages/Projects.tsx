import { GenerationsGallery } from "../components/GenerationsGallery";

/** Personal library of successfully completed generations. */
export function Projects() {
  return (
    <GenerationsGallery
      title="Projects"
      description="Your successful generations save here automatically — with previews, prompts, and model details. Failed jobs are hidden."
      emptyCta="Generate your first image"
    />
  );
}
