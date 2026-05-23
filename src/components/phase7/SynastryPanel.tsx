"use client";

import { GitCompareArrows, ShieldCheck } from "lucide-react";
import { useState } from "react";
import type { ChartCreateResponse, InterpretationMode, SynastryCreateResponse } from "../../types.js";

type SynastryPanelProps = {
  primaryChart: ChartCreateResponse;
  partnerChart: ChartCreateResponse;
};

export function SynastryPanel({ primaryChart, partnerChart }: SynastryPanelProps) {
  const [mode, setMode] = useState<InterpretationMode>("professional");
  const [hasConsent, setHasConsent] = useState(false);
  const [result, setResult] = useState<SynastryCreateResponse | undefined>();
  const [isTraceOpen, setIsTraceOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | undefined>();

  async function submitSynastry() {
    setIsLoading(true);
    setError(undefined);
    try {
      const response = await fetch("/api/synastry/create", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          mode,
          primary: {
            label: "甲方",
            chart_id: primaryChart.chart_id,
            chart: primaryChart.chart,
            consent: { agreed: hasConsent, no_sensitive_birth_data: true }
          },
          partner: {
            label: "乙方",
            chart_id: partnerChart.chart_id,
            chart: partnerChart.chart,
            consent: { agreed: hasConsent, no_sensitive_birth_data: true }
          }
        })
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error?.message ?? "合盘生成失败");
      }
      setResult(payload as SynastryCreateResponse);
      setIsTraceOpen(false);
    } catch (caught) {
      setResult(undefined);
      setError(caught instanceof Error ? caught.message : "合盘生成失败");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <section className="phase7-panel">
      <div className="panel-title-row">
        <GitCompareArrows aria-hidden="true" size={18} />
        <h2>合盘对照</h2>
      </div>
      <p className="muted">双盘对照只输出沟通、协作、边界和共同建议，不做婚恋成败判断。</p>

      <div className="interpret-mode-toggle" aria-label="合盘模式">
        <button type="button" aria-pressed={mode === "professional"} onClick={() => setMode("professional")}>
          专业
        </button>
        <button type="button" aria-pressed={mode === "entertainment"} onClick={() => setMode("entertainment")}>
          娱乐
        </button>
      </div>

      <label className="checkbox-row">
        <input checked={hasConsent} onChange={(event) => setHasConsent(event.target.checked)} type="checkbox" />
        我确认双方资料仅用于合盘演示，分享默认隐藏完整出生资料
      </label>

      <button className="primary-action" disabled={!hasConsent || isLoading} onClick={submitSynastry} type="button">
        <ShieldCheck aria-hidden="true" size={15} />
        {isLoading ? "Creating..." : "Create synastry"}
      </button>

      {error ? <p className="error-message">{error}</p> : null}

      {result ? (
        <div className="phase7-result">
          <p className="phase7-card-title">{result.share_card.title}</p>
          <p>{result.result.communication_style}</p>
          <p>{result.result.cooperation_rhythm}</p>
          <ul>
            {result.result.complementary_points.map((point) => (
              <li key={point}>{point}</li>
            ))}
          </ul>
          <p className="muted">{result.result.conflict_reminders[0]}</p>
          <p>{result.result.shared_advice[0]}</p>
          <p className="muted">{result.share_card.privacy_note}</p>
          <div className="safety-flags">
            {result.result.safety_flags.map((flag) => (
              <span key={flag}>{flag}</span>
            ))}
          </div>
          <button className="trace-toggle" onClick={() => setIsTraceOpen((current) => !current)} type="button">
            查看合盘规则溯源
          </button>
          {isTraceOpen ? (
            <ol className="trace-list">
              {result.result.trace.map((trace) => (
                <li key={trace.rule_id}>
                  <strong>{trace.rule_id}</strong>
                  <span>{trace.title}</span>
                  <span>{trace.source.title}</span>
                  <span>{trace.source.modern_translation}</span>
                </li>
              ))}
            </ol>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
