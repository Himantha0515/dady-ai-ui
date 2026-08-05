import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button, StatusBadge } from "./ui";
import { generationsApi } from "../lib/api/catalog";
import { AutoPlayVideo } from "./AutoPlayVideo";
import "../pages/Projects.css";

export type GalleryItem = {
  id: string;
  prompt: string | null;
  status: string;
  createdAt: string;
  mediaUrl: string | null;
  mimeType: string | null;
  modelName: string | null;
  aspectRatio: string | null;
  quality: string | null;
  duration: string | null;
  resolution: string | null;
  type: string;
};

function isVideoItem(item: GalleryItem): boolean {
  if (item.type === "video") return true;
  const mime = (item.mimeType || "").toLowerCase();
  if (mime.startsWith("video/")) return true;
  return !!item.mediaUrl && /\.(mp4|webm|mov)(\?|$)/i.test(item.mediaUrl);
}

type Props = {
  title: string;
  description: string;
  emptyCta?: string;
};

export function GenerationsGallery({ title, description, emptyCta }: Props) {
  const nav = useNavigate();
  const [items, setItems] = useState<GalleryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const rows = (await generationsApi.listRecent(80)) as Array<{
        id: string;
        prompt: string | null;
        application_status: string;
        created_at: string;
        generation_type?: string;
        input_configuration?: Record<string, unknown> | null;
        model_catalog?: { friendly_name?: string } | null;
        generation_outputs?: Array<{
          original_provider_url: string | null;
          mime_type?: string | null;
        }>;
      }>;

      const mapped: GalleryItem[] = [];
      const seenUrls = new Set<string>();

      for (const row of rows) {
        // Only successfully generated work with a media URL.
        if (row.application_status !== "completed") continue;
        const outs = (row.generation_outputs ?? []).filter((o) => o.original_provider_url);
        if (!outs.length) continue;

        const cfg = row.input_configuration ?? {};
        for (const o of outs) {
          const mediaUrl = o.original_provider_url as string;
          if (seenUrls.has(mediaUrl)) continue;
          seenUrls.add(mediaUrl);
          mapped.push({
            id: `${row.id}:${o.original_provider_url}`,
            prompt: row.prompt,
            status: row.application_status,
            createdAt: row.created_at,
            mediaUrl,
            mimeType: o.mime_type ?? null,
            modelName: row.model_catalog?.friendly_name ?? null,
            aspectRatio: typeof cfg.aspect_ratio === "string" ? cfg.aspect_ratio : null,
            quality: typeof cfg.quality === "string" ? cfg.quality : null,
            duration:
              typeof cfg.duration === "string"
                ? cfg.duration
                : typeof cfg.duration_seconds === "number"
                ? `${cfg.duration_seconds}s`
                : null,
            resolution: typeof cfg.resolution === "string" ? cfg.resolution : null,
            type: row.generation_type ?? "image",
          });
          break; // one preview card per generation
        }
      }

      setItems(mapped);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load generations");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="app-main projects-page">
      <div className="projects-top">
        <div>
          <h1>{title}</h1>
          <p>{description}</p>
        </div>
        <div className="projects-actions">
          <Button variant="ghost" onClick={() => void load()}>
            Refresh
          </Button>
          <Button onClick={() => nav("/app/create/image")}>Open Image Studio</Button>
          <Button variant="ghost" onClick={() => nav("/app/video")}>
            Open Video Studio
          </Button>
        </div>
      </div>

      {error ? <div className="field-error">{error}</div> : null}

      {loading ? (
        <div className="projects-empty">Loading your generations…</div>
      ) : items.length === 0 ? (
        <div className="projects-empty">
          <strong>No successful generations yet</strong>
          <p>Completed images and videos will appear here with full details.</p>
          <Button onClick={() => nav("/app/create/image")}>
            {emptyCta ?? "Generate something"}
          </Button>
        </div>
      ) : (
        <div className="projects-grid">
          {items.map((item) => {
            const video = isVideoItem(item);
            const studio = video ? "/app/video" : "/app/create/image";
            return (
              <article key={item.id} className="project-card">
                <Link
                  to={studio}
                  className="project-thumb"
                  title={item.prompt ?? "Open in studio"}
                  state={{ prompt: item.prompt ?? undefined, modelName: item.modelName ?? undefined }}
                >
                  {item.mediaUrl ? (
                    video ? (
                      <AutoPlayVideo src={item.mediaUrl} className="project-media" />
                    ) : (
                      <img src={item.mediaUrl} alt={item.prompt ?? "Generation"} loading="lazy" />
                    )
                  ) : (
                    <div className="project-thumb-empty">No preview</div>
                  )}
                </Link>
                <div className="project-body">
                  <div className="project-body-top">
                    <StatusBadge tone="success">completed</StatusBadge>
                    <span className="project-date">
                      {new Date(item.createdAt).toLocaleString()}
                    </span>
                  </div>
                  <p className="project-prompt">{item.prompt || "Untitled generation"}</p>
                  <div className="project-tags">
                    <span>{item.type}</span>
                    {item.modelName ? <span>{item.modelName}</span> : null}
                    {item.aspectRatio ? <span>{item.aspectRatio}</span> : null}
                    {item.duration ? <span>{item.duration}</span> : null}
                    {item.resolution ? <span>{item.resolution}</span> : null}
                    {item.quality ? <span>{item.quality}</span> : null}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
