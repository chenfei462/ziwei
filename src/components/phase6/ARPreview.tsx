"use client";

import { Camera, ShieldCheck } from "lucide-react";
import { useMemo } from "react";
import { buildChartViewModel } from "../../phase2/chartViewModel.js";
import type { ARCapability, ChartCreateResponse, ImmersiveSession } from "../../types.js";

type ARPreviewProps = {
  chart: ChartCreateResponse;
  session: ImmersiveSession;
  capability: ARCapability;
};

export function ARPreview({ chart, session, capability }: ARPreviewProps) {
  const viewModel = useMemo(
    () =>
      buildChartViewModel(chart.chart, {
        selectedPalaceId: session.active_palace_id,
        activeLayer: session.active_layer,
        activeMajorPeriodIndex: session.active_major_period_index
      }),
    [chart.chart, session.active_layer, session.active_major_period_index, session.active_palace_id]
  );
  const selectedPalace = session.active_palace_id ? viewModel.palaceById[session.active_palace_id] : viewModel.palaces[0];

  return (
    <main className="immersive-page ar-preview-page">
      <section className="immersive-header">
        <div>
          <p className="eyebrow">Phase 6 AR Mobile</p>
          <h1>AR Preview</h1>
        </div>
        <div className="status-strip">
          <span>{capability.status}</span>
          <span>{session.short_code}</span>
        </div>
      </section>
      <section className="ar-preview-shell">
        <div className="ar-camera-frame" aria-label="AR camera preview placeholder">
          <Camera aria-hidden="true" size={34} />
          <strong>{capability.status === "ready" ? "Camera overlay ready" : "Manual panorama fallback"}</strong>
          <span>{capability.fallback_mode}</span>
        </div>
        <div className="ar-overlay-orbit" aria-label="AR chart overlay">
          {viewModel.palaces.slice(0, 6).map((palace) => (
            <span key={palace.palace_id} className={palace.palace_id === selectedPalace?.palace_id ? "active" : undefined}>
              {palace.label}
            </span>
          ))}
        </div>
        <div className="immersive-privacy-strip">
          <ShieldCheck aria-hidden="true" size={15} />
          <span>no video frame</span>
          <span>camera permission: {capability.camera_permission}</span>
          <span>full birth date hidden</span>
        </div>
      </section>
    </main>
  );
}
