"use client";

import { CalendarDays, Sparkles } from "lucide-react";
import { useState } from "react";
import type { ChartCreateResponse, InterpretationMode, TimelineInterpretResponse } from "../../types.js";

type TimelinePanelProps = {
  chart: ChartCreateResponse;
};

const mvpPalaces = [
  { id: "life", label: "命宫" },
  { id: "career", label: "官禄宫" },
  { id: "wealth", label: "财帛宫" },
  { id: "spouse", label: "夫妻宫" },
  { id: "fortune", label: "福德宫" },
  { id: "migration", label: "迁移宫" }
] as const;

export function TimelinePanel({ chart }: TimelinePanelProps) {
  const [mode, setMode] = useState<InterpretationMode>("entertainment");
  const [year, setYear] = useState("2027");
  const [month, setMonth] = useState("5");
  const [palaceId, setPalaceId] = useState("career");
  const [result, setResult] = useState<TimelineInterpretResponse | undefined>();
  const [isTraceOpen, setIsTraceOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | undefined>();

  async function submitTimeline() {
    setIsLoading(true);
    setError(undefined);
    try {
      const parsedMonth = month ? Number(month) : undefined;
      const response = await fetch("/api/timeline/interpret", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          chart_id: chart.chart_id,
          chart: chart.chart,
          year: Number(year),
          month: parsedMonth,
          mode,
          palace_id: palaceId
        })
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error?.message ?? "年度主题生成失败");
      }
      setResult(payload as TimelineInterpretResponse);
      setIsTraceOpen(false);
    } catch (caught) {
      setResult(undefined);
      setError(caught instanceof Error ? caught.message : "年度主题生成失败");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <section className="phase7-panel">
      <div className="panel-title-row">
        <CalendarDays aria-hidden="true" size={18} />
        <h2>年度主题</h2>
      </div>
      <p className="muted">年度与月度主题只用于阶段观察，不生成流日或具体事件预测。</p>

      <div className="interpret-mode-toggle" aria-label="年度主题模式">
        <button type="button" aria-pressed={mode === "professional"} onClick={() => setMode("professional")}>
          专业
        </button>
        <button type="button" aria-pressed={mode === "entertainment"} onClick={() => setMode("entertainment")}>
          娱乐
        </button>
      </div>

      <div className="phase7-form-grid">
        <label>
          Year
          <input inputMode="numeric" max="2100" min="1900" onChange={(event) => setYear(event.target.value)} value={year} />
        </label>
        <label>
          Month
          <select onChange={(event) => setMonth(event.target.value)} value={month}>
            <option value="">全年</option>
            {Array.from({ length: 12 }, (_, index) => index + 1).map((item) => (
              <option key={item} value={String(item)}>
                {item}
              </option>
            ))}
          </select>
        </label>
        <label>
          Palace
          <select onChange={(event) => setPalaceId(event.target.value)} value={palaceId}>
            {mvpPalaces.map((palace) => (
              <option key={palace.id} value={palace.id}>
                {palace.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <button className="primary-action" disabled={isLoading} onClick={submitTimeline} type="button">
        <Sparkles aria-hidden="true" size={15} />
        {isLoading ? "Generating..." : "Generate annual theme"}
      </button>

      {error ? <p className="error-message">{error}</p> : null}

      {result ? (
        <div className="phase7-result">
          <p className="phase7-card-title">{result.annual_theme.title}</p>
          <p>{result.annual_theme.basis}</p>
          <p>{result.annual_theme.scenario}</p>
          <p>{result.annual_theme.advice}</p>
          {result.monthly_theme ? (
            <div className="phase7-subcard">
              <strong>{result.monthly_theme.title}</strong>
              <p>{result.monthly_theme.focus}</p>
              <p>{result.monthly_theme.advice}</p>
            </div>
          ) : null}
          <p className="phase7-card-title">{result.share_card.title}</p>
          <p className="muted">{result.share_card.privacy_note}</p>
          <div className="safety-flags">
            {result.annual_theme.safety_flags.map((flag) => (
              <span key={flag}>{flag}</span>
            ))}
          </div>
          <button className="trace-toggle" onClick={() => setIsTraceOpen((current) => !current)} type="button">
            查看年度规则溯源
          </button>
          {isTraceOpen ? (
            <ol className="trace-list">
              {result.trace.map((trace) => (
                <li key={trace.rule_id}>
                  <strong>{trace.rule_id}</strong>
                  <span>{trace.title}</span>
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
