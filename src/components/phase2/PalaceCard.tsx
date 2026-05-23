"use client";

import { ChevronDown, Layers, Orbit, ShieldCheck } from "lucide-react";
import { useState } from "react";
import type { PalaceViewModel, StarLayer } from "../../phase2/types.js";
import type { InterpretationMode, InterpretResponse } from "../../types.js";

type PalaceCardProps = {
  palace: PalaceViewModel | undefined;
  activeLayer: StarLayer;
  interpretation?: InterpretResponse;
  interpretationMode?: InterpretationMode;
  isInterpretationLoading?: boolean;
  interpretationError?: string;
  onInterpretationModeChange?: (mode: InterpretationMode) => void;
};

const interpretationModeOptions: Array<{ id: InterpretationMode; label: string }> = [
  { id: "professional", label: "专业" },
  { id: "entertainment", label: "娱乐" }
];

const confidenceLabels: Record<InterpretResponse["interpretation"]["confidence"], string> = {
  strong_structure: "强结构",
  medium_structure: "中结构",
  weak_structure: "弱结构"
};

export function PalaceCard({
  palace,
  activeLayer,
  interpretation,
  interpretationMode = "professional",
  isInterpretationLoading = false,
  interpretationError,
  onInterpretationModeChange
}: PalaceCardProps) {
  const [isTraceOpen, setIsTraceOpen] = useState(false);

  if (!palace) {
    return (
      <section className="detail-panel">
        <div className="panel-title-row">
          <Orbit aria-hidden="true" size={18} />
          <h2>结构化占位</h2>
        </div>
        <p>选择一个宫位后显示本宫、对宫、三合、邻宫、星曜层和大限信息。</p>
        <p className="muted">正式解读将在阶段 3 接入。</p>
      </section>
    );
  }

  return (
    <section className="detail-panel">
      <div className="panel-title-row">
        <Layers aria-hidden="true" size={18} />
        <h2>{palace.label}</h2>
      </div>
      <div className="interpret-mode-toggle" role="group" aria-label="解读模式">
        {interpretationModeOptions.map((mode) => (
          <button key={mode.id} type="button" aria-pressed={interpretationMode === mode.id} onClick={() => onInterpretationModeChange?.(mode.id)}>
            {mode.label}
          </button>
        ))}
      </div>
      {isInterpretationLoading ? <p className="muted">正在生成结构化解读...</p> : null}
      {interpretationError ? <p className="error-message">{interpretationError}</p> : null}
      {!interpretation && !isInterpretationLoading && !interpretationError ? <p className="muted">结构化占位。正式解读将在阶段 3 接入。</p> : null}
      {interpretation ? (
        <div className="interpretation-block" aria-live="polite">
          <div className="confidence-row">
            <span>{interpretation.status === "ready" ? "已开放" : "暂未开放"}</span>
            <span>{confidenceLabels[interpretation.interpretation.confidence]}</span>
          </div>
          <section className="interpret-section">
            <h3>依据</h3>
            <p>{interpretation.interpretation.basis}</p>
          </section>
          <section className="interpret-section">
            <h3>解释</h3>
            <p>{interpretation.interpretation.interpretation}</p>
          </section>
          <section className="interpret-section">
            <h3>现实场景</h3>
            <p>{interpretation.interpretation.scenario}</p>
          </section>
          <section className="interpret-section">
            <h3>建议</h3>
            <p>{interpretation.interpretation.advice}</p>
          </section>
          <div className="safety-flags" aria-label="安全标记">
            <ShieldCheck aria-hidden="true" size={15} />
            {interpretation.interpretation.safety_flags.map((flag) => (
              <span key={flag}>{flag}</span>
            ))}
          </div>
          {interpretation.trace.length ? (
            <div className="trace-panel">
              <button type="button" className="trace-toggle" onClick={() => setIsTraceOpen((current) => !current)}>
                <ChevronDown aria-hidden="true" size={15} />
                {isTraceOpen ? "收起规则溯源" : "查看规则溯源"}
              </button>
              {isTraceOpen ? (
                <ol className="trace-list">
                  {interpretation.trace.map((trace) => (
                    <li key={trace.rule_id}>
                      <span className="mono">{trace.rule_id}</span>
                      <span>{trace.source.title}</span>
                      <span>{trace.source.excerpt}</span>
                      <span>{trace.source.modern_translation}</span>
                      <span>权重 {trace.weight}</span>
                    </li>
                  ))}
                </ol>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
      <dl className="detail-list">
        <div>
          <dt>宫干地支</dt>
          <dd>
            {palace.stem}
            {palace.branch}
          </dd>
        </div>
        <div>
          <dt>当前层级</dt>
          <dd>{activeLayer === "main" ? "主星" : activeLayer === "support" ? "辅曜" : "四化"}</dd>
        </div>
        <div>
          <dt>主星</dt>
          <dd>{palace.main_stars.length ? palace.main_stars.join("、") : "无主星"}</dd>
        </div>
        <div>
          <dt>辅曜</dt>
          <dd>{palace.support_stars.slice(0, 6).join("、") || "无辅曜"}</dd>
        </div>
        <div>
          <dt>四化</dt>
          <dd>{palace.transforms.join("、") || "无四化"}</dd>
        </div>
        <div>
          <dt>关系</dt>
          <dd>
            对宫 {palace.relation_refs.opposite}；三合 {palace.relation_refs.triad.join("、")}；邻宫 {palace.relation_refs.neighbors.join("、")}
          </dd>
        </div>
      </dl>
    </section>
  );
}
