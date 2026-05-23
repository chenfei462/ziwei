"use client";

import { FileText, ShieldCheck, Video, WandSparkles } from "lucide-react";
import { useEffect, useState } from "react";
import type {
  ChartCreateResponse,
  ExportPreview,
  InterpretationMode,
  ReportDraft,
  ReportExportFormat,
  ReportType,
  SynastryCreateResponse,
  TimelineInterpretResponse
} from "../../types.js";

type CreatorWorkbenchProps = {
  chart: ChartCreateResponse;
  synastry: SynastryCreateResponse;
  timeline: TimelineInterpretResponse;
};

export function CreatorWorkbench({ chart, synastry, timeline }: CreatorWorkbenchProps) {
  const [reportType, setReportType] = useState<ReportType>("single_chart");
  const [mode, setMode] = useState<InterpretationMode>("professional");
  const [format, setFormat] = useState<ReportExportFormat>("pdf");
  const [draft, setDraft] = useState<ReportDraft | undefined>();
  const [preview, setPreview] = useState<ExportPreview | undefined>();
  const [isDraftLoading, setIsDraftLoading] = useState(false);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    setIsHydrated(true);
  }, []);

  async function generateDraft() {
    if (!isHydrated || isDraftLoading) return;
    setIsDraftLoading(true);
    setPreview(undefined);
    setError(undefined);
    try {
      const response = await fetch("/api/report/draft", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(buildDraftBody(reportType, mode, chart, synastry, timeline))
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error?.message ?? "Report draft failed.");
      }
      setDraft(payload as ReportDraft);
    } catch (caught) {
      setDraft(undefined);
      setError(caught instanceof Error ? caught.message : "Report draft failed.");
    } finally {
      setIsDraftLoading(false);
    }
  }

  async function previewExport() {
    if (!isHydrated || !draft || isPreviewLoading) return;
    setIsPreviewLoading(true);
    setError(undefined);
    try {
      const response = await fetch("/api/report/export-preview", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          report_id: draft.report_id,
          format
        })
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error?.message ?? "Export preview failed.");
      }
      setPreview(payload as ExportPreview);
    } catch (caught) {
      setPreview(undefined);
      setError(caught instanceof Error ? caught.message : "Export preview failed.");
    } finally {
      setIsPreviewLoading(false);
    }
  }

  return (
    <section className="phase8-panel">
      <div className="panel-title-row">
        <WandSparkles aria-hidden="true" size={18} />
        <h2>Creator Workbench</h2>
      </div>
      <p className="muted">
        Compose traceable reports and creator assets from the existing single-chart, synastry, and annual/monthly theme results.
      </p>

      <div className="phase8-control-grid">
        <label>
          Report type
          <select onChange={(event) => setReportType(event.target.value as ReportType)} value={reportType}>
            <option value="single_chart">single_chart</option>
            <option value="synastry">synastry</option>
            <option value="timeline">timeline</option>
          </select>
        </label>
        <label>
          Mode
          <select onChange={(event) => setMode(event.target.value as InterpretationMode)} value={mode}>
            <option value="professional">professional</option>
            <option value="entertainment">entertainment</option>
          </select>
        </label>
        <label>
          Export format
          <select onChange={(event) => setFormat(event.target.value as ReportExportFormat)} value={format}>
            <option value="pdf">pdf</option>
            <option value="html">html</option>
          </select>
        </label>
      </div>

      <div className="phase8-action-row">
        <button disabled={!isHydrated || isDraftLoading} onClick={generateDraft} type="button">
          <FileText aria-hidden="true" size={15} />
          {isDraftLoading ? "Generating..." : "Generate report draft"}
        </button>
        <button disabled={!isHydrated || !draft || isPreviewLoading} onClick={previewExport} type="button">
          <ShieldCheck aria-hidden="true" size={15} />
          {isPreviewLoading ? "Preparing..." : "Preview export"}
        </button>
      </div>

      {error ? <p className="error-message">{error}</p> : null}

      {draft ? (
        <div className="phase8-result">
          <div className="phase8-result-header">
            <div>
              <p className="phase8-kicker">{draft.template_id}</p>
              <h3>{draft.title}</h3>
            </div>
            <span className={draft.review.status === "approved" ? "phase8-status-ok" : "phase8-status-warn"}>
              {draft.review.status === "approved" ? "Report approved" : draft.review.status}
            </span>
          </div>
          <p className="muted">{draft.privacy_note}</p>
          <div className="safety-flags">
            {draft.safety_flags.slice(0, 6).map((flag) => (
              <span key={flag}>{flag}</span>
            ))}
          </div>

          <div className="phase8-section-list">
            {draft.sections.slice(0, 3).map((section) => (
              <article key={section.section_id}>
                <h4>{section.title}</h4>
                <p>{section.basis}</p>
                <small>{section.trace[0]?.rule_id ?? "trace_pending"}</small>
              </article>
            ))}
          </div>

          <div className="phase8-asset-list" aria-label="Creator assets">
            {draft.creator_assets.map((asset) => (
              <span key={asset.asset_id}>
                <Video aria-hidden="true" size={13} />
                {asset.asset_type}
              </span>
            ))}
          </div>
        </div>
      ) : null}

      {preview ? (
        <div className="phase8-preview">
          <strong>{preview.payment_status}</strong>
          <span>{preview.preview_url}</span>
          <span>{preview.format}</span>
          <small>{preview.privacy_note}</small>
        </div>
      ) : null}
    </section>
  );
}

function buildDraftBody(
  reportType: ReportType,
  mode: InterpretationMode,
  chart: ChartCreateResponse,
  synastry: SynastryCreateResponse,
  timeline: TimelineInterpretResponse
) {
  if (reportType === "single_chart") {
    return {
      report_type: reportType,
      chart_id: chart.chart_id,
      chart: chart.chart,
      mode
    };
  }
  if (reportType === "synastry") {
    return {
      report_type: reportType,
      mode,
      synastry
    };
  }
  return {
    report_type: reportType,
    chart_id: chart.chart_id,
    mode,
    timeline
  };
}
