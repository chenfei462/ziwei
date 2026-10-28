"use client";

import { BarChart3, Bookmark, FileText, Send, Share2 } from "lucide-react";
import { useState } from "react";
import type { PalaceViewModel } from "../../phase2/types.js";
import type {
  BetaDashboardSummary,
  BetaFavoriteResponse,
  BetaReportIntentResponse,
  BetaShareCardResponse,
  Chart,
  InterpretationMode,
  InterpretResponse,
  ReportTierId
} from "../../types.js";

type BetaGrowthPanelProps = {
  chartId: string;
  chart?: Chart;
  sessionId: string;
  selectedPalace: PalaceViewModel | undefined;
  interpretation?: InterpretResponse;
  mode: InterpretationMode;
};

const reportTiers: Array<{ id: ReportTierId; label: string }> = [
  { id: "starter_19", label: "Starter 19" },
  { id: "standard_49", label: "Standard 49" },
  { id: "premium_99", label: "Premium 99" }
];

export function BetaGrowthPanel({ chartId, chart, sessionId, selectedPalace, interpretation, mode }: BetaGrowthPanelProps) {
  const [shareResponse, setShareResponse] = useState<BetaShareCardResponse | undefined>();
  const [favoriteResponse, setFavoriteResponse] = useState<BetaFavoriteResponse | undefined>();
  const [reportResponse, setReportResponse] = useState<BetaReportIntentResponse | undefined>();
  const [dashboard, setDashboard] = useState<BetaDashboardSummary | undefined>();
  const [tierId, setTierId] = useState<ReportTierId>("standard_49");
  const [intentLevel, setIntentLevel] = useState(4);
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | undefined>();

  const selectedPalaceId = selectedPalace?.palace_id;
  const canUseBetaActions = Boolean(selectedPalaceId);

  async function generateShareCard() {
    if (!selectedPalaceId) return;
    setIsBusy(true);
    setError(undefined);
    try {
      const response = await postJson<BetaShareCardResponse>("/api/ops/product-signals/share-card", {
        chart_id: chartId,
        chart,
        palace_id: selectedPalaceId,
        mode,
        session_id: sessionId
      });
      setShareResponse(response);
      if (response.dashboard_snapshot) setDashboard(response.dashboard_snapshot);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Share card failed");
    } finally {
      setIsBusy(false);
    }
  }

  async function saveFavorite() {
    if (!selectedPalaceId) return;
    setIsBusy(true);
    setError(undefined);
    try {
      const response = await postJson<BetaFavoriteResponse>("/api/ops/product-signals/favorite", {
        chart_id: chartId,
        chart,
        palace_id: selectedPalaceId,
        session_id: sessionId,
        note: "Saved from internal product signal panel."
      });
      setFavoriteResponse(response);
      if (response.dashboard_snapshot) setDashboard(response.dashboard_snapshot);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Favorite failed");
    } finally {
      setIsBusy(false);
    }
  }

  async function submitIntent() {
    setIsBusy(true);
    setError(undefined);
    try {
      const response = await postJson<BetaReportIntentResponse>("/api/ops/product-signals/report-intent", {
        chart_id: chartId,
        session_id: sessionId,
        tier_id: tierId,
        intent_level: intentLevel,
        contact_opt_in: false,
        note: "Internal intent-only validation. No real payment."
      });
      setReportResponse(response);
      if (response.dashboard_snapshot) setDashboard(response.dashboard_snapshot);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Report intent failed");
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <section className="beta-growth-panel" data-testid="beta-growth-panel" aria-label="Internal product signal validation">
      <div className="panel-title-row">
        <BarChart3 aria-hidden="true" size={18} />
        <h2>Product Signals</h2>
      </div>
      <p className="muted">
        Internal operators can validate sharing, revisit intent, and paid-report interest. Full birth date, birth time, location detail, and camera frames stay hidden.
      </p>
      <div className="beta-current-context">
        <span>{selectedPalace ? selectedPalace.label : "Select a palace first"}</span>
        <span>{interpretation?.interpretation.confidence ?? "no interpretation yet"}</span>
      </div>
      <div className="beta-action-row">
        <button disabled={!canUseBetaActions || isBusy} type="button" onClick={generateShareCard}>
          <Share2 aria-hidden="true" size={15} />
          Generate share card
        </button>
        <button disabled={!canUseBetaActions || isBusy} type="button" onClick={saveFavorite}>
          <Bookmark aria-hidden="true" size={15} />
          Save favorite
        </button>
      </div>
      {shareResponse ? (
        <div className="beta-result-block" aria-live="polite">
          <strong>Share card created</strong>
          <p>{shareResponse.share_card.summary}</p>
          <small>{shareResponse.share_card.privacy_note}</small>
        </div>
      ) : null}
      {favoriteResponse ? (
        <p className="success-message">
          Favorite saved: <span className="mono">{favoriteResponse.favorite_id}</span>
        </p>
      ) : null}
      <div className="beta-report-grid">
        <label>
          Report tier
          <select value={tierId} onChange={(event) => setTierId(event.target.value as ReportTierId)}>
            {reportTiers.map((tier) => (
              <option key={tier.id} value={tier.id}>
                {tier.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Report interest
          <select value={intentLevel} onChange={(event) => setIntentLevel(Number(event.target.value))}>
            {[1, 2, 3, 4, 5].map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>
      </div>
      <button className="primary-action" disabled={isBusy} type="button" onClick={submitIntent}>
        <Send aria-hidden="true" size={15} />
        Submit report intent
      </button>
      {reportResponse ? (
        <p className="success-message">
          Report intent recorded: <span className="mono">{reportResponse.report_intent.payment_status}</span>
        </p>
      ) : null}
      {dashboard ? (
        <div className="beta-metric-row" aria-label="Beta dashboard snapshot">
          <span>share {dashboard.share_cards_created}</span>
          <span>favorite {dashboard.favorites_saved}</span>
          <span>intent {dashboard.report_intents}</span>
        </div>
      ) : null}
      <div className="beta-report-sample">
        <FileText aria-hidden="true" size={15} />
        <span>Report sample remains a preview; real payment, invoices, and order back office stay in the formal commerce flow.</span>
      </div>
      {error ? <p className="error-message">{error}</p> : null}
    </section>
  );
}

async function postJson<T>(url: string, payload: Record<string, unknown>): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload)
  });
  const body = await response.json();
  if (!response.ok) {
    throw new Error(body.error?.message ?? "Product signal request failed");
  }
  return body as T;
}
