import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button, Chip, CreditPill, Placeholder } from "../components/ui";
import { useModels, useWallet } from "../hooks/useCatalog";
import { formatModelPriceLabel } from "../lib/pricing/credits";
import { isRecommendedVideoModel } from "../lib/models/recommendedVideoModels";
import {
  CURATED_IMAGE_MODELS,
  isCuratedImageModel,
} from "../lib/models/curatedImageModels";
import type { ModelCatalogItem } from "../types/api";
import "./Models.css";

type Tab = "Videos" | "Images";

function toneFor(m: ModelCatalogItem): "default" | "pink" | "blue" | "lime" {
  if (m.quality_tier === "cinematic" || m.quality_tier === "premium") return "pink";
  if (m.quality_tier === "hd") return "blue";
  if (m.quality_tier === "fast") return "lime";
  return "default";
}

export function Models() {
  const nav = useNavigate();
  const { credits } = useWallet();
  const [tab, setTab] = useState<Tab>("Videos");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string | null>(null);
  const { data: videoModels = [], isLoading: loadingVideo } = useModels("video");
  const { data: imageModels = [], isLoading: loadingImage } = useModels("image");

  const curatedImages = useMemo(
    () => imageModels.filter((m) => isCuratedImageModel(m)).slice(0, 10),
    [imageModels],
  );
  const list = tab === "Videos" ? videoModels : curatedImages;
  const loading = tab === "Videos" ? loadingVideo : loadingImage;

  const categories = useMemo(() => {
    const set = new Set(list.map((m) => m.category).filter(Boolean));
    return [...set].sort();
  }, [list]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const rows = list.filter((m) => {
      if (category && m.category !== category) return false;
      if (!q) return true;
      return (
        m.friendly_name.toLowerCase().includes(q) ||
        m.provider_model_id.toLowerCase().includes(q) ||
        (m.description ?? "").toLowerCase().includes(q) ||
        m.category.toLowerCase().includes(q) ||
        m.slug.toLowerCase().includes(q)
      );
    });
    if (tab !== "Videos") return rows;
    return [...rows].sort((a, b) => {
      const ar = isRecommendedVideoModel(a) ? 0 : 1;
      const br = isRecommendedVideoModel(b) ? 0 : 1;
      if (ar !== br) return ar - br;
      return (a.display_order ?? 0) - (b.display_order ?? 0);
    });
  }, [list, search, category, tab]);

  return (
    <div className="app-main models">
      <h1>Models</h1>
      <p className="models-lead">
        {tab === "Videos"
          ? "Curated video lineup — clear names, honest credit prices."
          : "10 curated image models — 4 excellent, 3 medium, 3 low-credit. Credits include Dady margin."}
      </p>

      <div className="models-toolbar">
        <div className="search grow">
          <span>⌕</span>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder='Search models — "kling", "flux", "veo"'
            style={{
              flex: 1,
              border: 0,
              background: "transparent",
              color: "inherit",
              font: "inherit",
              outline: "none",
            }}
          />
        </div>
        <span className="ghost-chip">
          {tab === "Videos" ? "⇅ Sort: Curated order" : "⇅ Sort: Lowest cost"}
        </span>
        <CreditPill value={credits} />
      </div>

      <div className="chip-row wrap" style={{ marginBottom: 14 }}>
        {(["Videos", "Images"] as Tab[]).map((t) => (
          <Chip
            key={t}
            active={tab === t}
            onClick={() => {
              setTab(t);
              setCategory(null);
            }}
          >
            {t}
          </Chip>
        ))}
      </div>

      <div className="filter-row">
        <span className="dim">Category</span>
        <button
          type="button"
          className={`filter-pill${!category ? " on" : ""}`}
          onClick={() => setCategory(null)}
        >
          All
        </button>
        {categories.map((c) => (
          <button
            key={c}
            type="button"
            className={`filter-pill${category === c ? " on" : ""}`}
            onClick={() => setCategory(c)}
          >
            {c}
          </button>
        ))}
      </div>

      {loading ? <p className="models-lead">Loading models…</p> : null}

      <div className="models-grid">
        {filtered.map((m) => (
          <article key={m.id} className="model-card">
            <Placeholder label="" height={150} variant={toneFor(m)} />
            <div className="model-body">
              <div className="model-top">
                <div>
                  <h3>
                    {m.friendly_name}
                    {tab === "Videos" && isRecommendedVideoModel(m) ? (
                      <em className="model-rec-badge">Recommended</em>
                    ) : null}
                  </h3>
                  <p>{m.provider_model_id}</p>
                </div>
              </div>
              <div className="chip-row">
                {tab === "Videos" && isRecommendedVideoModel(m) ? (
                  <span className="mini-tag green">recommended</span>
                ) : null}
                {tab === "Images"
                  ? (() => {
                      const tier = CURATED_IMAGE_MODELS.find(
                        (c) =>
                          c.slug === m.slug ||
                          c.provider_model_id === m.provider_model_id,
                      )?.tier;
                      return tier ? (
                        <span className="mini-tag green">
                          {tier === "excellent"
                            ? "excellent"
                            : tier === "medium"
                            ? "medium"
                            : "low credits"}
                        </span>
                      ) : null;
                    })()
                  : null}
                <span className="mini-tag green">{m.quality_tier}</span>
                <span className="mini-tag muted">{m.category}</span>
              </div>
              <p className="model-desc">
                {m.description || "Ready for commercial generations."}
              </p>
              <div className="model-foot">
                <strong>
                  {tab === "Videos"
                    ? formatModelPriceLabel(m, 5)
                    : formatModelPriceLabel(m)}
                </strong>
                <div className="model-actions">
                  <Button
                    variant="lime"
                    onClick={() =>
                      nav(tab === "Videos" ? "/app/video" : "/app/create/image", {
                        state: { modelName: m.friendly_name },
                      })
                    }
                  >
                    Try Model
                  </Button>
                </div>
              </div>
            </div>
          </article>
        ))}
      </div>

      {!loading && !filtered.length ? (
        <p className="models-lead">
          No active models yet. An admin can sync fal.ai from /admin/models and activate priced
          endpoints.
        </p>
      ) : null}
    </div>
  );
}
