"use client";

import { ChevronRight, CircleDot, RotateCcw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { BirthProfile, ChartCreateResponse, InterpretationMode, InterpretResponse } from "../../types.js";
import { buildChartViewModel } from "../../phase2/chartViewModel.js";
import { applyGestureEvent, createGestureEventLog, createInitialInteractionState, nextLayer, selectPalace } from "../../phase2/interactionState.js";
import type { GestureEventLog, StarLayer } from "../../phase2/types.js";
import { BirthProfileForm } from "./BirthProfileForm.js";
import { ChartBoard2D } from "./ChartBoard2D.js";
import { GestureController } from "./GestureController.js";
import { GestureLogPanel } from "./GestureLogPanel.js";
import { ModeTabs } from "./ModeTabs.js";
import { PalaceCard } from "./PalaceCard.js";
import { FeedbackPanel } from "../phase4/FeedbackPanel.js";
import { ClosedTestNotice } from "../phase4/ClosedTestNotice.js";
import { BetaGrowthPanel } from "../phase5/BetaGrowthPanel.js";
import type { FeedbackTaskId } from "../../types.js";

type PrototypeShellProps = {
  initialChart: ChartCreateResponse;
  initialBirthProfile: BirthProfile;
};

export function PrototypeShell({ initialChart, initialBirthProfile }: PrototypeShellProps) {
  const [chartResponse, setChartResponse] = useState(initialChart);
  const [interaction, setInteraction] = useState(createInitialInteractionState());
  const [interpretationMode, setInterpretationMode] = useState<InterpretationMode>("professional");
  const [interpretation, setInterpretation] = useState<InterpretResponse | undefined>();
  const [isInterpretationLoading, setIsInterpretationLoading] = useState(false);
  const [interpretationError, setInterpretationError] = useState<string | undefined>();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [isChartApiReady, setIsChartApiReady] = useState(false);
  const [sessionId] = useState(() => `session_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`);

  const viewModel = useMemo(
    () =>
      buildChartViewModel(chartResponse.chart, {
        selectedPalaceId: interaction.selectedPalaceId,
        activeLayer: interaction.activeLayer,
        activeMajorPeriodIndex: interaction.activeMajorPeriodIndex
      }),
    [chartResponse.chart, interaction.activeLayer, interaction.activeMajorPeriodIndex, interaction.selectedPalaceId]
  );
  const selectedPalace = interaction.selectedPalaceId ? viewModel.palaceById[interaction.selectedPalaceId] : undefined;
  const targetPalaceId = useMemo(() => {
    if (!viewModel.palaces.length) return undefined;
    const selectedIndex = viewModel.palaces.findIndex((palace) => palace.palace_id === interaction.selectedPalaceId);
    return viewModel.palaces[(selectedIndex + 1) % viewModel.palaces.length]?.palace_id;
  }, [interaction.selectedPalaceId, viewModel.palaces]);
  const activeMajorPeriodId = viewModel.activeMajorPeriod?.period_id;
  const completedTasks = useMemo<FeedbackTaskId[]>(() => {
    const tasks: FeedbackTaskId[] = ["create_chart"];
    if (interaction.selectedPalaceId) tasks.push("select_palace");
    if (interpretationMode === "entertainment") tasks.push("switch_mode");
    if (interpretation?.trace.length) tasks.push("open_trace");
    if (interaction.logs.length || interaction.status === "zoomed_layer" || interaction.status === "major_period_active") {
      tasks.push("gesture_or_fallback");
    }
    return [...new Set(tasks)];
  }, [interaction.logs.length, interaction.selectedPalaceId, interaction.status, interpretation?.trace.length, interpretationMode]);

  useEffect(() => {
    const controller = new AbortController();
    setIsChartApiReady(false);

    fetch("/api/chart/create", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ birth_profile: initialBirthProfile }),
      signal: controller.signal
    })
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok) {
          throw new Error(payload.error?.message ?? "初始开盘失败");
        }
        setChartResponse(payload as ChartCreateResponse);
        setInteraction(createInitialInteractionState());
        setInterpretation(undefined);
        setIsChartApiReady(true);
      })
      .catch((caught) => {
        if (caught instanceof DOMException && caught.name === "AbortError") return;
        setError(caught instanceof Error ? caught.message : "初始开盘失败");
      });

    return () => controller.abort();
  }, [initialBirthProfile]);

  useEffect(() => {
    if (!interaction.selectedPalaceId) {
      setInterpretation(undefined);
      setInterpretationError(undefined);
      setIsInterpretationLoading(false);
      return;
    }

    const controller = new AbortController();
    setIsInterpretationLoading(true);
    setInterpretationError(undefined);

    fetch("/api/interpret", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        chart_id: chartResponse.chart_id,
        palace_id: interaction.selectedPalaceId,
        mode: interpretationMode,
        major_period_id: activeMajorPeriodId,
        include_trace: true,
        chart: chartResponse.chart
      }),
      signal: controller.signal
    })
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok) {
          throw new Error(payload.error?.message ?? "解读失败");
        }
        setInterpretation(payload as InterpretResponse);
      })
      .catch((caught) => {
        if (caught instanceof DOMException && caught.name === "AbortError") return;
        setInterpretation(undefined);
        setInterpretationError(caught instanceof Error ? caught.message : "解读失败");
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setIsInterpretationLoading(false);
        }
      });

    return () => controller.abort();
  }, [activeMajorPeriodId, chartResponse.chart_id, interaction.selectedPalaceId, interpretationMode]);

  async function createChartFromProfile(profile: BirthProfile) {
    setIsLoading(true);
    setError(undefined);
    setIsChartApiReady(false);
    try {
      const response = await fetch("/api/chart/create", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ birth_profile: profile })
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error?.message ?? "开盘失败");
      }
      setChartResponse(payload as ChartCreateResponse);
      setInteraction(createInitialInteractionState());
      setInterpretation(undefined);
      setIsChartApiReady(true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "开盘失败");
    } finally {
      setIsLoading(false);
    }
  }

  function handleGesture(log: GestureEventLog) {
    setInteraction((current) => applyGestureEvent(current, log));
  }

  function handleLayerChange(layer: StarLayer) {
    setInteraction((current) => ({ ...current, status: "zoomed_layer", activeLayer: layer }));
  }

  return (
    <main className="prototype-page">
      <section className="workspace-header">
        <div>
          <p className="eyebrow">Phase 2 Interactive Prototype</p>
          <h1>紫微星垣互动原型</h1>
        </div>
        <div className="status-strip" aria-label="当前状态">
          <span>{interaction.status}</span>
          <span>{isChartApiReady ? "api_chart_ready" : "api_chart_syncing"}</span>
          <span>{chartResponse.chart_id}</span>
          <a href="/internal/phases/phase7">合盘对照 / 年度主题</a>
          <a href="/internal/phases/phase8">Reports / Creator</a>
          <a href="/internal/phases/phase9">Commerce</a>
          <a href="/internal/phases/phase10">Launch Ops</a>
          <a href="/internal/phases/phase11">Rules / Knowledge</a>
          <a href="/internal/phases/phase12">Daily</a>
        </div>
      </section>

      <section className="prototype-grid">
        <aside className="left-rail">
          <ClosedTestNotice />
          <BirthProfileForm isLoading={isLoading} onSubmit={createChartFromProfile} />
          {error ? <p className="error-message">{error}</p> : null}
          <ModeTabs activeLayer={interaction.activeLayer} onLayerChange={handleLayerChange} />
          <div className="quick-actions">
            <button type="button" onClick={() => setInteraction((current) => ({ ...current, status: "zoomed_layer", activeLayer: nextLayer(current.activeLayer) }))}>
              <CircleDot aria-hidden="true" size={15} />
              切换星曜层
            </button>
            <button type="button" onClick={() => setInteraction((current) => ({ ...current, status: "major_period_active", activeMajorPeriodIndex: (current.activeMajorPeriodIndex + 1) % viewModel.majorPeriods.length }))}>
              <ChevronRight aria-hidden="true" size={15} />
              切换大限
            </button>
            <button type="button" onClick={() => setInteraction((current) => applyGestureEvent(current, createGestureEventLog("open_palm", 0.96, "reset_view")))}>
              <RotateCcw aria-hidden="true" size={15} />
              全局复位
            </button>
          </div>
        </aside>

        <section className="chart-column">
          <ChartBoard2D
            activeLayer={interaction.activeLayer}
            onSelectPalace={(palaceId) => {
              if (!isChartApiReady) return;
              setInteraction((current) => selectPalace(current, palaceId));
            }}
            selectedPalaceId={interaction.selectedPalaceId}
            viewModel={viewModel}
          />
        </section>

        <aside className="right-rail">
          <PalaceCard
            activeLayer={interaction.activeLayer}
            interpretation={interpretation}
            interpretationError={interpretationError}
            interpretationMode={interpretationMode}
            isInterpretationLoading={isInterpretationLoading}
            onInterpretationModeChange={setInterpretationMode}
            palace={selectedPalace}
          />
          <section className="period-panel">
            <div className="panel-title-row">
              <ChevronRight aria-hidden="true" size={18} />
              <h2>大限时间轮</h2>
            </div>
            <p>
              {viewModel.activeMajorPeriod?.age_start} - {viewModel.activeMajorPeriod?.age_end} 岁 · {viewModel.activeMajorPeriod?.palace_id}
            </p>
          </section>
          <GestureController selectedPalaceId={interaction.selectedPalaceId} targetPalaceId={targetPalaceId} palaces={viewModel.palaces} onGesture={handleGesture} />
          <GestureLogPanel logs={interaction.logs} />
          <BetaGrowthPanel
            chartId={chartResponse.chart_id}
            chart={chartResponse.chart}
            interpretation={interpretation}
            mode={interpretationMode}
            selectedPalace={selectedPalace}
            sessionId={sessionId}
          />
          <FeedbackPanel chartId={chartResponse.chart_id} completedTasks={completedTasks} sessionId={sessionId} />
        </aside>
      </section>
    </main>
  );
}
