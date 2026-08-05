import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "../components/ui";
import { wishlistApi, type WishlistItem } from "../lib/api/catalog";
import { isWishlistVideo } from "../lib/wishlistMedia";
import "./Wishlist.css";

async function downloadMedia(url: string, filename: string) {
  try {
    const res = await fetch(url, { mode: "cors" });
    if (!res.ok) throw new Error("fetch failed");
    const blob = await res.blob();
    const objectUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = objectUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(objectUrl);
  } catch {
    window.open(url, "_blank", "noopener,noreferrer");
  }
}

export function Wishlist() {
  const nav = useNavigate();
  const [items, setItems] = useState<WishlistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      setItems(await wishlistApi.list());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load wishlist");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const remove = async (id: string) => {
    setBusyId(id);
    try {
      await wishlistApi.remove(id);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not remove item");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="app-main wishlist-page">
      <div className="wishlist-top">
        <div>
          <h1>Wishlist</h1>
          <p>All saved images and videos — with prompt, model, and settings.</p>
        </div>
        <div className="wishlist-top-actions">
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
        <div className="wishlist-empty-state">Loading wishlist…</div>
      ) : items.length === 0 ? (
        <div className="wishlist-empty-state">
          <strong>No wishlist items yet</strong>
          <p>Generate an image or video, then tap Wishlist on the result.</p>
          <Button onClick={() => nav("/app/create/image")}>Go create</Button>
        </div>
      ) : (
        <div className="wishlist-grid">
          {items.map((item) => {
            const video = isWishlistVideo(item);
            return (
              <article key={item.id} className="wishlist-page-card">
                <a
                  className="wishlist-page-thumb"
                  href={item.image_url}
                  target="_blank"
                  rel="noreferrer"
                >
                  {video ? (
                    <video src={item.image_url} muted playsInline preload="metadata" />
                  ) : (
                    <img src={item.image_url} alt={item.prompt ?? "Wishlist item"} />
                  )}
                </a>
                <div className="wishlist-page-body">
                  <p>{item.prompt || "No prompt saved"}</p>
                  <div className="wishlist-page-tags">
                    <span>{video ? "video" : "image"}</span>
                    {item.model_name ? <span>{item.model_name}</span> : null}
                    {item.aspect_ratio ? <span>{item.aspect_ratio}</span> : null}
                    {item.quality ? <span>{item.quality}</span> : null}
                    {typeof item.settings?.duration === "string" ? (
                      <span>{item.settings.duration}</span>
                    ) : null}
                  </div>
                  <div className="wishlist-page-actions">
                    <Button
                      variant="ghost"
                      onClick={() =>
                        void downloadMedia(
                          item.image_url,
                          `dady-wish-${item.id.slice(0, 8)}.${video ? "mp4" : "jpg"}`,
                        )
                      }
                    >
                      Download
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={() => nav(video ? "/app/video" : "/app/create/image")}
                    >
                      Open studio
                    </Button>
                    <Button
                      variant="ghost"
                      disabled={busyId === item.id}
                      onClick={() => void remove(item.id)}
                    >
                      Remove
                    </Button>
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
