import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "../../components/ui";
import { invokeFunction, isSupabaseConfigured, supabase } from "../../lib/supabase/client";
import {
  CREATOR_PLAN_CREDITS,
  CREDIT_VALUE_INR,
  DEFAULT_FX_USD_INR,
  DEFAULT_MARGIN_PCT,
  MINI_PACK_CREDITS,
  STUDIO_PLAN_CREDITS,
  falUsdToCredits,
  normalizePricingUnit,
  packYield,
  suggestedCreditsAtMargins,
} from "../../lib/pricing/credits";
import "./AdminFalPricing.css";

type InventoryRow = {
  endpoint_id: string;
  display_name: string;
  category: string;
  generation_type: "image" | "video";
  unit: string | null;
  unit_price_usd: number | null;
  currency: string;
  status: string;
  fetched_at: string;
};

type SyncResult = {
  ok: boolean;
  inventory_count: number;
  catalog_upserted: number;
  catalog_activated: number;
  margin_pct: number;
  fx_usd_inr: number;
  matrix: InventoryRow[];
};

function csvEscape(v: unknown) {
  const s = String(v ?? "");
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function AdminFalPricing() {
  const [rows, setRows] = useState<InventoryRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [marginPct, setMarginPct] = useState(DEFAULT_MARGIN_PCT);
  const [fx, setFx] = useState(DEFAULT_FX_USD_INR);
  const [activatePriced, setActivatePriced] = useState(false);
  const [typeFilter, setTypeFilter] = useState<"all" | "image" | "video">("all");

  const loadInventory = async () => {
    if (!isSupabaseConfigured || !supabase) return;
    setLoading(true);
    setError(null);
    try {
      const { data, error: qErr } = await supabase
        .from("fal_model_inventory")
        .select(
          "endpoint_id, display_name, category, generation_type, unit, unit_price_usd, currency, status, fetched_at",
        )
        .order("unit_price_usd", { ascending: true, nullsFirst: false });
      if (qErr) throw qErr;
      setRows((data ?? []) as InventoryRow[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load inventory");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadInventory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    return rows.filter((r) => (typeFilter === "all" ? true : r.generation_type === typeFilter));
  }, [rows, typeFilter]);

  const runSync = async () => {
    setSyncing(true);
    setError(null);
    setMessage(null);
    try {
      const res = await invokeFunction<SyncResult>("sync-fal-catalog", {
        margin_pct: marginPct,
        fx_usd_inr: fx,
        activate_priced: activatePriced,
        promote_to_catalog: true,
      });
      setRows(res.matrix ?? []);
      setMessage(
        `Synced ${res.inventory_count} inventory rows · catalog upserted ${res.catalog_upserted} · activated ${res.catalog_activated}`,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sync failed");
    } finally {
      setSyncing(false);
    }
  };

  const downloadCsv = () => {
    const header = [
      "endpoint_id",
      "display_name",
      "generation_type",
      "category",
      "unit",
      "fal_usd",
      "fal_inr",
      "credits_m40",
      "credits_m50",
      "credits_m60",
      "credits_selected_margin",
      "mini_jobs",
      "creator_jobs",
      "studio_jobs",
      "mini_5s_videos",
      "mini_10s_videos",
    ];
    const lines = [header.join(",")];
    for (const r of filtered) {
      const usd = r.unit_price_usd ?? 0;
      const unit = normalizePricingUnit(r.unit);
      const sug = suggestedCreditsAtMargins(usd, fx);
      const selected = falUsdToCredits(usd, { fxUsdInr: fx, marginPct });
      const unitsPerJob =
        r.generation_type === "video" && unit === "second" ? 5 : 1;
      lines.push(
        [
          r.endpoint_id,
          r.display_name,
          r.generation_type,
          r.category,
          r.unit ?? "",
          usd,
          (usd * fx).toFixed(4),
          sug.margin40,
          sug.margin50,
          sug.margin60,
          selected,
          packYield(selected, MINI_PACK_CREDITS, unitsPerJob),
          packYield(selected, CREATOR_PLAN_CREDITS, unitsPerJob),
          packYield(selected, STUDIO_PLAN_CREDITS, unitsPerJob),
          r.generation_type === "video" && unit === "second"
            ? packYield(selected, MINI_PACK_CREDITS, 5)
            : "",
          r.generation_type === "video" && unit === "second"
            ? packYield(selected, MINI_PACK_CREDITS, 10)
            : "",
        ]
          .map(csvEscape)
          .join(","),
      );
    }
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `fal-pricing-matrix-${typeFilter}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="admin-fal">
      <div className="admin-fal-head">
        <div>
          <h1>Fal catalog &amp; pricing</h1>
          <p>
            Pull all fal image/video models with live USD pricing. Sorted cheap → expensive.
            Credit yardstick: ₹{CREDIT_VALUE_INR}/credit (Mini pack). Default margin {DEFAULT_MARGIN_PCT}%.
          </p>
        </div>
        <Link to="/admin">
          <Button variant="ghost">Back</Button>
        </Link>
      </div>

      <div className="admin-fal-controls">
        <label>
          Margin %
          <input
            type="number"
            min={10}
            max={90}
            value={marginPct}
            onChange={(e) => setMarginPct(Number(e.target.value) || 50)}
          />
        </label>
        <label>
          USD→INR
          <input
            type="number"
            min={1}
            step={0.1}
            value={fx}
            onChange={(e) => setFx(Number(e.target.value) || DEFAULT_FX_USD_INR)}
          />
        </label>
        <label className="admin-fal-check">
          <input
            type="checkbox"
            checked={activatePriced}
            onChange={(e) => setActivatePriced(e.target.checked)}
          />
          Activate priced models for users
        </label>
        <Button variant="lime" disabled={syncing} onClick={() => void runSync()}>
          {syncing ? "Syncing…" : "Sync from fal.ai"}
        </Button>
        <Button variant="ghost" disabled={loading} onClick={() => void loadInventory()}>
          Refresh
        </Button>
        <Button variant="ghost" disabled={!filtered.length} onClick={downloadCsv}>
          Download CSV
        </Button>
      </div>

      <div className="admin-fal-filters">
        {(["all", "image", "video"] as const).map((t) => (
          <button
            key={t}
            type="button"
            className={typeFilter === t ? "active" : undefined}
            onClick={() => setTypeFilter(t)}
          >
            {t}
          </button>
        ))}
        <span className="admin-fal-count">{filtered.length} models</span>
      </div>

      {error ? <div className="admin-fal-error">{error}</div> : null}
      {message ? <div className="admin-fal-ok">{message}</div> : null}

      <div className="admin-fal-table-wrap">
        <table className="admin-fal-table">
          <thead>
            <tr>
              <th>Model</th>
              <th>Type</th>
              <th>Unit</th>
              <th>Fal USD</th>
              <th>Fal INR</th>
              <th>40%</th>
              <th>50%</th>
              <th>60%</th>
              <th>@ margin</th>
              <th>Mini jobs</th>
              <th>5s / Mini</th>
              <th>10s / Mini</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => {
              const usd = r.unit_price_usd ?? 0;
              const unit = normalizePricingUnit(r.unit);
              const sug = suggestedCreditsAtMargins(usd, fx);
              const selected = falUsdToCredits(usd, { fxUsdInr: fx, marginPct });
              const unitsPerJob =
                r.generation_type === "video" && unit === "second" ? 5 : 1;
              return (
                <tr key={r.endpoint_id}>
                  <td>
                    <strong>{r.display_name}</strong>
                    <div className="admin-fal-id">{r.endpoint_id}</div>
                  </td>
                  <td>{r.generation_type}</td>
                  <td>{r.unit ?? "—"}</td>
                  <td>{usd ? `$${usd}` : "—"}</td>
                  <td>{usd ? `₹${(usd * fx).toFixed(2)}` : "—"}</td>
                  <td>{usd ? sug.margin40 : "—"}</td>
                  <td>{usd ? sug.margin50 : "—"}</td>
                  <td>{usd ? sug.margin60 : "—"}</td>
                  <td>
                    <strong>{usd ? selected : "—"}</strong>
                  </td>
                  <td>{usd ? packYield(selected, MINI_PACK_CREDITS, unitsPerJob) : "—"}</td>
                  <td>
                    {r.generation_type === "video" && unit === "second" && usd
                      ? packYield(selected, MINI_PACK_CREDITS, 5)
                      : "—"}
                  </td>
                  <td>
                    {r.generation_type === "video" && unit === "second" && usd
                      ? packYield(selected, MINI_PACK_CREDITS, 10)
                      : "—"}
                  </td>
                </tr>
              );
            })}
            {!filtered.length && !loading ? (
              <tr>
                <td colSpan={12}>No inventory yet. Run Sync from fal.ai.</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
