import type { GestureAction, GestureFrame, GestureSensitivity, GestureType, PalaceViewModel } from "./types.js";

export type LandmarkPoint = {
  x: number;
  y: number;
  z?: number;
};

export type MediaPipeGestureCategory = {
  categoryName: string;
  score: number;
};

const sensitivitySettings: Record<
  GestureSensitivity,
  {
    scoreThreshold: number;
    pinchRatio: number;
    stableFrames: number;
    circleRadians: number;
    cooldownMs: number;
  }
> = {
  responsive: {
    scoreThreshold: 0.6,
    pinchRatio: 0.38,
    stableFrames: 2,
    circleRadians: Math.PI * 1.45,
    cooldownMs: 500
  },
  balanced: {
    scoreThreshold: 0.65,
    pinchRatio: 0.28,
    stableFrames: 3,
    circleRadians: Math.PI * 1.7,
    cooldownMs: 800
  },
  strict: {
    scoreThreshold: 0.88,
    pinchRatio: 0.2,
    stableFrames: 5,
    circleRadians: Math.PI * 1.95,
    cooldownMs: 1200
  }
};

const mediaPipeGestureMap: Record<string, GestureType | undefined> = {
  Open_Palm: "open_palm",
  Closed_Fist: "fist",
  Pointing_Up: "point"
};

export function actionForGesture(type: GestureFrame["type"]): GestureAction {
  switch (type) {
    case "open_palm":
      return "reset_view";
    case "point":
      return "select_palace";
    case "pinch":
      return "cycle_layer";
    case "circle":
      return "cycle_major_period";
    case "fist":
      return "go_back";
    default: {
      const exhaustive: never = type;
      throw new Error(`Unhandled gesture type: ${exhaustive}`);
    }
  }
}

export function classifyHandLandmarks(frame: GestureFrame): GestureFrame {
  return frame;
}

export function mapMediaPipeGesture(
  category: MediaPipeGestureCategory | undefined,
  sensitivity: GestureSensitivity = "balanced"
): GestureFrame | undefined {
  if (!category || category.score < sensitivitySettings[sensitivity].scoreThreshold) return undefined;
  const type = mediaPipeGestureMap[category.categoryName];
  if (!type) return undefined;
  return {
    type,
    confidence: category.score,
    source: "camera",
    raw_category: category.categoryName
  };
}

export function classifyPinchFromLandmarks(landmarks: LandmarkPoint[] | undefined, sensitivity: GestureSensitivity): GestureFrame | undefined {
  if (!landmarks || landmarks.length < 10) return undefined;
  const thumbTip = landmarks[4];
  const indexTip = landmarks[8];
  const wrist = landmarks[0];
  const middleMcp = landmarks[9];
  if (!thumbTip || !indexTip || !wrist || !middleMcp) return undefined;

  const palmScale = Math.max(distance(wrist, middleMcp), 0.001);
  const pinchDistance = distance(thumbTip, indexTip);
  const ratio = pinchDistance / palmScale;
  const threshold = sensitivitySettings[sensitivity].pinchRatio;
  if (ratio > threshold) return undefined;

  return {
    type: "pinch",
    confidence: clamp(1 - ratio / threshold),
    source: "camera",
    raw_category: "Pinch"
  };
}

export function createCircleTracker(sensitivity: GestureSensitivity) {
  const settings = sensitivitySettings[sensitivity];
  let lastAngle: number | undefined;
  let accumulatedAngle = 0;
  let samples = 0;

  return {
    push(landmarks: LandmarkPoint[] | undefined): GestureFrame | undefined {
      if (!landmarks || landmarks.length < 10 || !landmarks[8] || !landmarks[9]) {
        lastAngle = undefined;
        accumulatedAngle = 0;
        samples = 0;
        return undefined;
      }

      const indexTip = landmarks[8];
      const palmCenter = landmarks[9];
      const radius = distance(indexTip, palmCenter);
      if (radius < 0.08) {
        lastAngle = undefined;
        accumulatedAngle = 0;
        samples = 0;
        return undefined;
      }

      const angle = Math.atan2(indexTip.y - palmCenter.y, indexTip.x - palmCenter.x);
      if (lastAngle !== undefined) {
        accumulatedAngle += Math.abs(shortestAngleDelta(angle, lastAngle));
      }
      lastAngle = angle;
      samples += 1;

      if (samples >= settings.stableFrames + 2 && accumulatedAngle >= settings.circleRadians) {
        accumulatedAngle = 0;
        samples = 0;
        return {
          type: "circle",
          confidence: 0.9,
          source: "camera",
          raw_category: "Circle"
        };
      }
      return undefined;
    },
    reset() {
      lastAngle = undefined;
      accumulatedAngle = 0;
      samples = 0;
    }
  };
}

export function createGestureStabilizer(sensitivity: GestureSensitivity) {
  const settings = sensitivitySettings[sensitivity];
  let candidateType: GestureType | undefined;
  let frames = 0;
  let lastTriggeredAt = 0;

  return {
    push(frame: GestureFrame | undefined, now = Date.now()): GestureFrame | undefined {
      if (!frame) {
        candidateType = undefined;
        frames = 0;
        return undefined;
      }

      if (frame.type !== candidateType) {
        candidateType = frame.type;
        frames = 1;
      } else {
        frames += 1;
      }

      if (frames < settings.stableFrames) return undefined;
      if (now - lastTriggeredAt < settings.cooldownMs) return undefined;

      lastTriggeredAt = now;
      candidateType = undefined;
      const stabilityFrames = frames;
      frames = 0;
      return {
        ...frame,
        stability_frames: stabilityFrames
      };
    },
    getSnapshot() {
      return {
        candidateType,
        frames,
        requiredFrames: settings.stableFrames
      };
    },
    reset() {
      candidateType = undefined;
      frames = 0;
      lastTriggeredAt = 0;
    }
  };
}

export function targetPalaceFromPoint(point: LandmarkPoint | undefined, palaces: PalaceViewModel[]): string | undefined {
  if (!point || !palaces.length) return undefined;
  const boardPoint = {
    x: point.x * 840,
    y: point.y * 760
  };
  return palaces
    .map((palace) => ({
      palace_id: palace.palace_id,
      distance: distance(boardPoint, {
        x: palace.position.x + palace.position.width / 2,
        y: palace.position.y + palace.position.height / 2
      })
    }))
    .sort((a, b) => a.distance - b.distance)[0]?.palace_id;
}

export function topGestureCategory(categories: MediaPipeGestureCategory[][] | undefined): MediaPipeGestureCategory | undefined {
  return categories?.[0]?.slice().sort((a, b) => b.score - a.score)[0];
}

export function runWithSuppressedMediaPipeInfoLogs<T>(operation: () => T): T {
  const originalError = console.error;
  console.error = (...args: unknown[]) => {
    if (isIgnorableMediaPipeInfoLog(args)) return;
    originalError(...args);
  };

  try {
    const result = operation();
    if (isPromiseLike(result)) {
      return result.finally(() => {
        console.error = originalError;
      }) as T;
    }
    console.error = originalError;
    return result;
  } catch (error) {
    console.error = originalError;
    throw error;
  }
}

function isIgnorableMediaPipeInfoLog(args: unknown[]): boolean {
  const first = args[0];
  return typeof first === "string" && first.includes("INFO: Created TensorFlow Lite XNNPACK delegate for CPU.");
}

function isPromiseLike<T>(value: T): value is T & Promise<Awaited<T>> {
  const maybePromise = value as unknown as Partial<Promise<Awaited<T>>>;
  return (
    typeof value === "object" &&
    value !== null &&
    typeof maybePromise.then === "function" &&
    typeof maybePromise.catch === "function" &&
    typeof maybePromise.finally === "function"
  );
}

function distance(a: LandmarkPoint, b: LandmarkPoint): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function shortestAngleDelta(current: number, previous: number): number {
  let delta = current - previous;
  while (delta > Math.PI) delta -= Math.PI * 2;
  while (delta < -Math.PI) delta += Math.PI * 2;
  return delta;
}

function clamp(value: number): number {
  return Math.min(1, Math.max(0, value));
}
