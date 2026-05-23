import { describe, expect, test, vi } from "vitest";
import type { PalaceViewModel } from "../src/phase2/types.js";
import {
  classifyPinchFromLandmarks,
  createCircleTracker,
  createGestureStabilizer,
  mapMediaPipeGesture,
  runWithSuppressedMediaPipeInfoLogs,
  targetPalaceFromPoint
} from "../src/phase2/gestureRecognizer.js";

function makeHand(thumbTip: { x: number; y: number }, indexTip: { x: number; y: number }) {
  const landmarks = Array.from({ length: 21 }, () => ({ x: 0.5, y: 0.5, z: 0 }));
  landmarks[0] = { x: 0.5, y: 0.8, z: 0 };
  landmarks[5] = { x: 0.45, y: 0.55, z: 0 };
  landmarks[9] = { x: 0.5, y: 0.5, z: 0 };
  landmarks[4] = { ...thumbTip, z: 0 };
  landmarks[8] = { ...indexTip, z: 0 };
  return landmarks;
}

const palaces = [
  {
    palace_id: "life",
    position: { x: 0, y: 0, width: 100, height: 100 }
  },
  {
    palace_id: "career",
    position: { x: 740, y: 660, width: 100, height: 100 }
  }
] as PalaceViewModel[];

describe("phase 2 camera gesture recognition", () => {
  test("maps MediaPipe canned gestures into project gesture frames", () => {
    expect(mapMediaPipeGesture({ categoryName: "Open_Palm", score: 0.93 }, "balanced")).toMatchObject({
      type: "open_palm",
      source: "camera",
      raw_category: "Open_Palm"
    });
    expect(mapMediaPipeGesture({ categoryName: "Open_Palm", score: 0.66 }, "balanced")?.type).toBe("open_palm");
    expect(mapMediaPipeGesture({ categoryName: "Closed_Fist", score: 0.93 }, "balanced")?.type).toBe("fist");
    expect(mapMediaPipeGesture({ categoryName: "Pointing_Up", score: 0.93 }, "balanced")?.type).toBe("point");
    expect(mapMediaPipeGesture({ categoryName: "Thumb_Up", score: 0.99 }, "balanced")).toBeUndefined();
    expect(mapMediaPipeGesture({ categoryName: "Open_Palm", score: 0.7 }, "strict")).toBeUndefined();
  });

  test("detects pinch from thumb/index distance with sensitivity thresholds", () => {
    const closeHand = makeHand({ x: 0.5, y: 0.5 }, { x: 0.53, y: 0.5 });
    const borderlineHand = makeHand({ x: 0.5, y: 0.5 }, { x: 0.59, y: 0.5 });

    expect(classifyPinchFromLandmarks(closeHand, "balanced")?.type).toBe("pinch");
    expect(classifyPinchFromLandmarks(borderlineHand, "responsive")?.type).toBe("pinch");
    expect(classifyPinchFromLandmarks(borderlineHand, "strict")).toBeUndefined();
  });

  test("detects circle only after a stable index-finger orbit", () => {
    const tracker = createCircleTracker("balanced");
    const points = [
      { x: 0.7, y: 0.5 },
      { x: 0.6, y: 0.67 },
      { x: 0.4, y: 0.67 },
      { x: 0.3, y: 0.5 },
      { x: 0.4, y: 0.33 },
      { x: 0.6, y: 0.33 },
      { x: 0.7, y: 0.5 }
    ];

    const frames = points.map((point) => tracker.push(makeHand({ x: 0.2, y: 0.2 }, point)));

    expect(frames.slice(0, -1).every((frame) => frame === undefined)).toBe(true);
    expect(frames.at(-1)).toMatchObject({ type: "circle", source: "camera" });
  });

  test("requires more stable frames in stricter modes", () => {
    const responsive = createGestureStabilizer("responsive");
    const strict = createGestureStabilizer("strict");
    const frame = { type: "point" as const, confidence: 0.95, source: "camera" as const, raw_category: "Pointing_Up" };

    expect(responsive.push(frame)).toBeUndefined();
    expect(responsive.getSnapshot()).toMatchObject({ candidateType: "point", frames: 1, requiredFrames: 2 });
    expect(responsive.push(frame)).toMatchObject({ type: "point", stability_frames: 2 });

    for (let index = 0; index < 4; index += 1) {
      expect(strict.push(frame)).toBeUndefined();
    }
    expect(strict.push(frame)).toMatchObject({ type: "point", stability_frames: 5 });
  });

  test("maps the pointing fingertip to the nearest palace tile", () => {
    expect(targetPalaceFromPoint({ x: 0.05, y: 0.05 }, palaces)).toBe("life");
    expect(targetPalaceFromPoint({ x: 0.95, y: 0.95 }, palaces)).toBe("career");
  });

  test("suppresses only TensorFlow Lite INFO logs from MediaPipe", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);

    await runWithSuppressedMediaPipeInfoLogs(async () => {
      console.error("INFO: Created TensorFlow Lite XNNPACK delegate for CPU.");
      console.error("real media error");
    });

    expect(consoleError).toHaveBeenCalledTimes(1);
    expect(consoleError).toHaveBeenCalledWith("real media error");
    consoleError.mockRestore();
  });
});
