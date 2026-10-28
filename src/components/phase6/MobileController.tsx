"use client";

import { Bookmark, CircleDot, Maximize2, RotateCcw, Send, Share2 } from "lucide-react";
import { useEffect, useState } from "react";
import type { ImmersiveSession, StageEventResponse } from "../../types.js";

type MobileControllerProps = {
  session: ImmersiveSession;
};

const palaceOptions = [
  { id: "life", label: "Life palace" },
  { id: "career", label: "Career palace" },
  { id: "wealth", label: "Wealth palace" },
  { id: "spouse", label: "Spouse palace" },
  { id: "fortune", label: "Fortune palace" },
  { id: "migration", label: "Migration palace" }
] as const;

export function MobileController({ session }: MobileControllerProps) {
  const [targetPalaceId, setTargetPalaceId] = useState("wealth");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [lastResponse, setLastResponse] = useState<StageEventResponse | undefined>();
  const [error, setError] = useState<string | undefined>();
  const [isHydrated, setIsHydrated] = useState(false);
  const isControllerReady = isHydrated && status !== "sending";

  useEffect(() => {
    setIsHydrated(true);
  }, []);

  async function sendEvent(type: StageEventResponse["event"]["type"], target_palace_id?: string) {
    if (!isControllerReady) return;
    setStatus("sending");
    setError(undefined);
    try {
      const response = await fetch(`/api/ops/immersive/session/${session.session_id}/event`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          type,
          target_palace_id,
          confidence: 1,
          session_snapshot: session
        })
      });
      const body = await response.json();
      if (!response.ok) {
        throw new Error(body.error?.message ?? "Immersive event failed");
      }
      setLastResponse(body as StageEventResponse);
      setStatus("sent");
    } catch (caught) {
      setStatus("error");
      setError(caught instanceof Error ? caught.message : "Immersive event failed");
    }
  }

  return (
    <main className="immersive-page immersive-control-page">
      <section className="immersive-header">
        <div>
          <p className="eyebrow">Phase 6 Control Surface</p>
          <h1>Mobile Controller</h1>
        </div>
        <div className="status-strip">
          <span>{session.short_code}</span>
          <span>{session.session_id}</span>
        </div>
      </section>
      <section className="mobile-controller-panel">
        <label>
          Target palace
          <select value={targetPalaceId} onChange={(event) => setTargetPalaceId(event.target.value)}>
            {palaceOptions.map((palace) => (
              <option key={palace.id} value={palace.id}>
                {palace.label}
              </option>
            ))}
          </select>
        </label>
        <div className="immersive-control-grid">
          <button disabled={!isControllerReady} type="button" onClick={() => sendEvent("select_palace", targetPalaceId)}>
            <Send aria-hidden="true" size={15} />
            Select palace
          </button>
          <button disabled={!isControllerReady} type="button" onClick={() => sendEvent("cycle_layer")}>
            <CircleDot aria-hidden="true" size={15} />
            Cycle layer
          </button>
          <button disabled={!isControllerReady} type="button" onClick={() => sendEvent("cycle_major_period")}>
            <RotateCcw aria-hidden="true" size={15} />
            Cycle major period
          </button>
          <button disabled={!isControllerReady} type="button" onClick={() => sendEvent("enter_panorama")}>
            <Maximize2 aria-hidden="true" size={15} />
            Enter panorama
          </button>
          <button disabled={!isControllerReady} type="button" onClick={() => sendEvent("toggle_mode")}>
            <Bookmark aria-hidden="true" size={15} />
            Toggle mode
          </button>
          <button disabled={!isControllerReady} type="button" onClick={() => sendEvent("create_share_card", targetPalaceId)}>
            <Share2 aria-hidden="true" size={15} />
            Generate share card
          </button>
        </div>
        {status === "sending" ? <p className="muted">Sending event...</p> : null}
        {status === "sent" ? (
          <p className="success-message">
            Event sent: <span className="mono">{lastResponse?.event.action}</span>
          </p>
        ) : null}
        {status === "error" ? <p className="error-message">{error}</p> : null}
        <p className="muted">Controller events store action metadata only. Full birth data and video frames are never sent.</p>
      </section>
    </main>
  );
}
