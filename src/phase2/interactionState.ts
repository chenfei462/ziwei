import type { GestureAction, GestureEventLog, GestureType, InteractionState, StarLayer } from "./types.js";
import type { GestureSource } from "./types.js";

const layerOrder: StarLayer[] = ["main", "support", "transforms"];
const confidenceThreshold = 0.75;

export function createInitialInteractionState(): InteractionState {
  return {
    status: "idle",
    activeLayer: "main",
    activeMajorPeriodIndex: 0,
    logs: []
  };
}

export function selectPalace(state: InteractionState, palaceId: string): InteractionState {
  return {
    ...state,
    status: "selected_palace",
    selectedPalaceId: palaceId
  };
}

export function createGestureEventLog(
  type: GestureType,
  confidence: number,
  action: GestureAction,
  targetPalaceId?: string,
  options: { source?: GestureSource; raw_category?: string; stability_frames?: number } = {}
): GestureEventLog {
  return {
    id: `gesture_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    type,
    confidence,
    timestamp: new Date().toISOString(),
    action,
    target_palace_id: targetPalaceId,
    source: options.source ?? "simulation",
    raw_category: options.raw_category,
    stability_frames: options.stability_frames,
    no_video_frame: true,
    status: confidence >= confidenceThreshold ? "confirmed" : "rejected"
  };
}

export function applyGestureEvent(state: InteractionState, log: GestureEventLog): InteractionState {
  const logs = [log, ...state.logs].slice(0, 30);
  if (log.status === "rejected") {
    return {
      ...state,
      status: "gesture_preview",
      logs
    };
  }

  switch (log.action) {
    case "reset_view":
      return {
        ...createInitialInteractionState(),
        logs
      };
    case "select_palace":
      return {
        ...state,
        status: "gesture_confirmed",
        selectedPalaceId: log.target_palace_id ?? state.selectedPalaceId,
        logs
      };
    case "cycle_layer":
      return {
        ...state,
        status: "zoomed_layer",
        activeLayer: nextLayer(state.activeLayer),
        logs
      };
    case "cycle_major_period":
      return {
        ...state,
        status: "major_period_active",
        activeMajorPeriodIndex: (state.activeMajorPeriodIndex + 1) % 12,
        logs
      };
    case "go_back":
      return {
        ...state,
        status: state.selectedPalaceId ? "cooldown" : "idle",
        selectedPalaceId: undefined,
        logs,
        cooldownUntil: Date.now() + 300
      };
    default: {
      const exhaustive: never = log.action;
      throw new Error(`Unhandled gesture action: ${exhaustive}`);
    }
  }
}

export function nextLayer(layer: StarLayer): StarLayer {
  return layerOrder[(layerOrder.indexOf(layer) + 1) % layerOrder.length];
}
