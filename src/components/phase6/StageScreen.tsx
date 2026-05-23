"use client";

import { MonitorUp, ShieldCheck } from "lucide-react";
import { useMemo, useState } from "react";
import { buildChartViewModel } from "../../phase2/chartViewModel.js";
import type { ChartCreateResponse, ImmersiveSession } from "../../types.js";
import { ChartBoard2D } from "../phase2/ChartBoard2D.js";

type StageScreenProps = {
  chart: ChartCreateResponse;
  session: ImmersiveSession;
  enablePolling?: boolean;
};

export function StageScreen({ chart, session, enablePolling = false }: StageScreenProps) {
  const [liveSession] = useState(session);
  const viewModel = useMemo(
    () =>
      buildChartViewModel(chart.chart, {
        selectedPalaceId: liveSession.active_palace_id,
        activeLayer: liveSession.active_layer,
        activeMajorPeriodIndex: liveSession.active_major_period_index
      }),
    [chart.chart, liveSession.active_layer, liveSession.active_major_period_index, liveSession.active_palace_id]
  );
  const selectedPalace = liveSession.active_palace_id ? viewModel.palaceById[liveSession.active_palace_id] : undefined;

  void enablePolling;

  return (
    <main className="immersive-page immersive-stage-page">
      <section className="immersive-header">
        <div>
          <p className="eyebrow">Phase 6 Immersive Extension</p>
          <h1>Stage Screen</h1>
        </div>
        <div className="status-strip" aria-label="immersive session">
          <span data-testid="immersive-session-id">{liveSession.session_id}</span>
          <span>{liveSession.short_code}</span>
          <span>{liveSession.display_mode}</span>
        </div>
      </section>
      <section className="stage-screen-frame" data-testid="stage-screen-frame">
        <div className="stage-board-zone">
          <ChartBoard2D activeLayer={liveSession.active_layer} onSelectPalace={() => undefined} selectedPalaceId={liveSession.active_palace_id} viewModel={viewModel} />
        </div>
        <aside className="stage-info-zone">
          <div className="panel-title-row">
            <MonitorUp aria-hidden="true" size={18} />
            <h2>{selectedPalace?.label ?? "Panorama"}</h2>
          </div>
          <p className="stage-kicker">{liveSession.is_panorama ? "Full panorama active" : "Controller linked"}</p>
          <dl className="detail-list">
            <div>
              <dt>Layer</dt>
              <dd>{liveSession.active_layer}</dd>
            </div>
            <div>
              <dt>Mode</dt>
              <dd>{liveSession.interpretation_mode}</dd>
            </div>
            <div>
              <dt>Major period</dt>
              <dd>{viewModel.activeMajorPeriod ? `${viewModel.activeMajorPeriod.age_start}-${viewModel.activeMajorPeriod.age_end}` : "none"}</dd>
            </div>
            <div>
              <dt>Event count</dt>
              <dd>{liveSession.event_count}</dd>
            </div>
          </dl>
          <div className="immersive-privacy-strip">
            <ShieldCheck aria-hidden="true" size={15} />
            <span>full birth date hidden</span>
            <span>birth time hidden</span>
            <span>location detail hidden</span>
            <span>no video frame</span>
          </div>
        </aside>
      </section>
    </main>
  );
}
