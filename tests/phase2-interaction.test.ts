import { describe, expect, test } from "vitest";
import {
  applyGestureEvent,
  createInitialInteractionState,
  createGestureEventLog,
  selectPalace
} from "../src/phase2/interactionState.js";

describe("phase 2 interaction state", () => {
  test("selects a palace and enters the selected palace state", () => {
    const state = selectPalace(createInitialInteractionState(), "career");

    expect(state.status).toBe("selected_palace");
    expect(state.selectedPalaceId).toBe("career");
  });

  test("maps the five MVP gestures to the planned actions and records no video frames", () => {
    let state = selectPalace(createInitialInteractionState(), "life");

    state = applyGestureEvent(state, createGestureEventLog("point", 0.94, "select_palace", "career"));
    expect(state.status).toBe("gesture_confirmed");
    expect(state.selectedPalaceId).toBe("career");
    expect(state.logs[0]).toMatchObject({
      type: "point",
      action: "select_palace",
      target_palace_id: "career",
      no_video_frame: true
    });

    state = applyGestureEvent(state, createGestureEventLog("pinch", 0.91, "cycle_layer"));
    expect(state.status).toBe("zoomed_layer");
    expect(state.activeLayer).toBe("support");

    state = applyGestureEvent(state, createGestureEventLog("circle", 0.9, "cycle_major_period"));
    expect(state.status).toBe("major_period_active");
    expect(state.activeMajorPeriodIndex).toBe(1);

    state = applyGestureEvent(state, createGestureEventLog("fist", 0.92, "go_back"));
    expect(state.selectedPalaceId).toBeUndefined();

    state = applyGestureEvent(state, createGestureEventLog("open_palm", 0.96, "reset_view"));
    expect(state.status).toBe("idle");
    expect(state.logs.every((entry) => entry.no_video_frame)).toBe(true);
  });

  test("rejects low confidence gesture events without changing selection", () => {
    const state = selectPalace(createInitialInteractionState(), "life");
    const next = applyGestureEvent(state, createGestureEventLog("open_palm", 0.2, "reset_view"));

    expect(next.status).toBe("gesture_preview");
    expect(next.selectedPalaceId).toBe("life");
    expect(next.logs[0].status).toBe("rejected");
  });
});
