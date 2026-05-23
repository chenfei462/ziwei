// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { GestureController } from "../src/components/phase2/GestureController.js";
import type { PalaceViewModel } from "../src/phase2/types.js";

const recognizerMock = vi.hoisted(() => ({
  recognizeForVideo: vi.fn()
}));

vi.mock("@mediapipe/tasks-vision", () => ({
  FilesetResolver: {
    forVisionTasks: vi.fn(async () => ({}))
  },
  GestureRecognizer: {
    createFromOptions: vi.fn(async () => recognizerMock)
  }
}));

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

describe("phase 2 camera gesture controller", () => {
  const rafQueue: FrameRequestCallback[] = [];

  beforeEach(() => {
    recognizerMock.recognizeForVideo.mockReset();
    recognizerMock.recognizeForVideo.mockReturnValue({
      gestures: [[{ categoryName: "Pointing_Up", score: 0.96 }]],
      landmarks: [
        Array.from({ length: 21 }, (_, index) => ({
          x: index === 8 ? 0.05 : 0.5,
          y: index === 8 ? 0.05 : 0.5,
          z: 0
        }))
      ]
    });
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: {
        getUserMedia: vi.fn(async () => ({
          getTracks: () => [{ stop: vi.fn() }]
        }))
      }
    });
    Object.defineProperty(HTMLMediaElement.prototype, "readyState", {
      configurable: true,
      get: () => 4
    });
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      rafQueue.push(callback);
      return rafQueue.length;
    });
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
  });

  afterEach(() => {
    cleanup();
    rafQueue.length = 0;
    vi.unstubAllGlobals();
  });

  test("starts camera recognition and emits a stable pointing gesture", async () => {
    const onGesture = vi.fn();
    render(<GestureController palaces={palaces} targetPalaceId="life" selectedPalaceId={undefined} onGesture={onGesture} />);

    fireEvent.click(screen.getByRole("button", { name: /启用摄像头/ }));

    await screen.findByText(/识别中/);
    for (let index = 0; index < 4; index += 1) {
      rafQueue.shift()?.(performance.now() + index * 16);
    }

    await waitFor(() =>
      expect(onGesture).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "point",
          source: "camera",
          target_palace_id: "life",
          raw_category: "Pointing_Up",
          stability_frames: 3
        })
      )
    );
  });
});
