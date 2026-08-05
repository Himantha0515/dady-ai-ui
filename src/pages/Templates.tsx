import { useNavigate } from "react-router-dom";
import { AutoPlayVideo } from "../components/AutoPlayVideo";
import { GenerationsGallery } from "../components/GenerationsGallery";
import { showcaseImages } from "../lib/showcaseImages";
import { viralPresets } from "../lib/viralPresets";
import "./TemplatesFeatured.css";

/** Curated autoplay templates + the user’s successful generations. */
export function Templates() {
  const nav = useNavigate();

  return (
    <div className="templates-page">
      <section className="templates-featured app-main">
        <div className="templates-featured-head">
          <h2>Featured templates</h2>
          <p>Configured viral videos and image looks — tap any preview to open the studio.</p>
        </div>

        <h3 className="templates-featured-sub">Video presets</h3>
        <div className="templates-featured-grid templates-featured-grid--video">
          {viralPresets.map((p) => (
            <button
              key={p.label}
              type="button"
              className="templates-featured-card"
              onClick={() => nav("/app/video", { state: { prompt: p.prompt } })}
            >
              <AutoPlayVideo src={p.videoUrl} className="templates-featured-media" />
              <span className="templates-featured-label">{p.label}</span>
            </button>
          ))}
        </div>

        <h3 className="templates-featured-sub">Image looks</h3>
        <div className="templates-featured-grid templates-featured-grid--image">
          {showcaseImages.map((img) => (
            <button
              key={img.label}
              type="button"
              className="templates-featured-card"
              onClick={() => nav("/app/create/image", { state: { prompt: img.prompt } })}
            >
              <img
                className="templates-featured-media"
                src={img.imageUrl}
                alt={img.label}
                loading="lazy"
              />
              <span className="templates-featured-label">{img.label}</span>
            </button>
          ))}
        </div>
      </section>

      <GenerationsGallery
        title="Your generations"
        description="Successfully generated images and videos from your account — with previews, prompts, and model details."
        emptyCta="Generate your first image"
      />
    </div>
  );
}
