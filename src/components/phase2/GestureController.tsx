"use client";

import { Camera, Hand, MousePointer2, RotateCcw, ZoomIn } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import {
  actionForGesture,
  classifyPinchFromLandmarks,
  createCircleTracker,
  createGestureStabilizer,
  mapMediaPipeGesture,
  runWithSuppressedMediaPipeInfoLogs,
  targetPalaceFromPoint,
  topGestureCategory,
  type LandmarkPoint,
  type MediaPipeGestureCategory
} from "../../phase2/gestureRecognizer.js";
import { createGestureEventLog } from "../../phase2/interactionState.js";
import type { GestureEventLog, GestureFrame, GestureSensitivity, GestureType, PalaceViewModel } from "../../phase2/types.js";

type GestureControllerProps = {
  selectedPalaceId: string | undefined;
  targetPalaceId: string | undefined;
  palaces?: PalaceViewModel[];
  onGesture: (log: GestureEventLog) => void;
};

type CameraStatus = "idle" | "loading" | "recognizing" | "unavailable";

type MediaPipeGestureResult = {
  gestures?: MediaPipeGestureCategory[][];
  landmarks?: LandmarkPoint[][];
};

type MediaPipeGestureRecognizer = {
  recognizeForVideo(videoFrame: HTMLVideoElement, timestamp: number): MediaPipeGestureResult;
  close?: () => void;
};

const simulatedGestures: Array<{ type: GestureType; label: string }> = [
  { type: "open_palm", label: "模拟开掌" },
  { type: "point", label: "模拟点选" },
  { type: "pinch", label: "模拟捏合" },
  { type: "circle", label: "模拟画圈" },
  { type: "fist", label: "模拟握拳" }
];

const sensitivityLabels: Record<GestureSensitivity, string> = {
  responsive: "灵敏",
  balanced: "均衡",
  strict: "严格"
};

const emptyPalaces: PalaceViewModel[] = [];

const wasmPath = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/wasm";
const modelPath = "https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task";

export function GestureController({ selectedPalaceId, targetPalaceId, palaces, onGesture }: GestureControllerProps) {
  const resolvedPalaces = palaces ?? emptyPalaces;
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recognizerRef = useRef<MediaPipeGestureRecognizer | null>(null);
  const frameRequestRef = useRef<number | undefined>(undefined);
  const onGestureRef = useRef(onGesture);
  const selectedPalaceIdRef = useRef(selectedPalaceId);
  const targetPalaceIdRef = useRef(targetPalaceId);
  const palacesRef = useRef(resolvedPalaces);
  const [cameraStatus, setCameraStatus] = useState<CameraStatus>("idle");
  const [sensitivity, setSensitivity] = useState<GestureSensitivity>("balanced");
  const sensitivityRef = useRef<GestureSensitivity>("balanced");
  const stabilizerRef = useRef(createGestureStabilizer("balanced"));
  const circleTrackerRef = useRef(createCircleTracker("balanced"));
  const [debug, setDebug] = useState({
    rawCategory: "None",
    confidence: 0,
    stableFrames: 0,
    target: targetPalaceId ?? "none"
  });

  useEffect(() => {
    onGestureRef.current = onGesture;
  }, [onGesture]);

  useEffect(() => {
    selectedPalaceIdRef.current = selectedPalaceId;
    targetPalaceIdRef.current = targetPalaceId;
    palacesRef.current = resolvedPalaces;
    setDebug((current) => ({ ...current, target: targetPalaceId ?? "none" }));
  }, [resolvedPalaces, selectedPalaceId, targetPalaceId]);

  useEffect(() => {
    sensitivityRef.current = sensitivity;
    stabilizerRef.current = createGestureStabilizer(sensitivity);
    circleTrackerRef.current = createCircleTracker(sensitivity);
  }, [sensitivity]);

  useEffect(() => {
    return () => {
      stopRecognitionLoop();
      recognizerRef.current?.close?.();
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  async function startCamera() {
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraStatus("unavailable");
      return;
    }
    try {
      setCameraStatus("loading");
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" }, audio: false });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }

      const { FilesetResolver, GestureRecognizer } = await import("@mediapipe/tasks-vision");
      const vision = await runWithSuppressedMediaPipeInfoLogs(() => FilesetResolver.forVisionTasks(wasmPath));
      recognizerRef.current = (await runWithSuppressedMediaPipeInfoLogs(() =>
        GestureRecognizer.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: modelPath
          },
          runningMode: "VIDEO",
          numHands: 1,
          minHandDetectionConfidence: 0.6,
          minHandPresenceConfidence: 0.6,
          minTrackingConfidence: 0.6
        })
      )) as MediaPipeGestureRecognizer;

      setCameraStatus("recognizing");
      startRecognitionLoop();
    } catch {
      setCameraStatus("unavailable");
    }
  }

  function emitGesture(type: GestureType) {
    const frame: GestureFrame = {
      type,
      confidence: 0.96,
      source: "simulation",
      target_palace_id: type === "point" ? targetPalaceId : selectedPalaceId
    };
    onGesture(createLogFromFrame(frame));
  }

  function startRecognitionLoop() {
    stopRecognitionLoop();

    const tick = (timestamp: number) => {
      const recognizer = recognizerRef.current;
      const video = videoRef.current;
      if (recognizer && video) {
        const frame = classifyVideoFrame(recognizer, video, timestamp);
        const stableFrame = stabilizerRef.current.push(frame, timestamp);
        if (stableFrame) {
          onGestureRef.current(createLogFromFrame(stableFrame));
        }
      }
      frameRequestRef.current = requestAnimationFrame(tick);
    };

    frameRequestRef.current = requestAnimationFrame(tick);
  }

  function stopRecognitionLoop() {
    if (frameRequestRef.current !== undefined) {
      cancelAnimationFrame(frameRequestRef.current);
      frameRequestRef.current = undefined;
    }
  }

  function classifyVideoFrame(recognizer: MediaPipeGestureRecognizer, video: HTMLVideoElement, timestamp: number): GestureFrame | undefined {
    let result: MediaPipeGestureResult;
    try {
      result = runWithSuppressedMediaPipeInfoLogs(() => recognizer.recognizeForVideo(video, timestamp));
    } catch {
      return undefined;
    }

    const landmarks = result.landmarks?.[0];
    const topCategory = topGestureCategory(result.gestures);
    const geometricFrame = classifyPinchFromLandmarks(landmarks, sensitivityRef.current) ?? circleTrackerRef.current.push(landmarks);
    const cannedFrame = mapMediaPipeGesture(topCategory, sensitivityRef.current);
    const frame = geometricFrame ?? cannedFrame;
    const target = resolveTargetPalace(frame, landmarks);

    setDebug({
      rawCategory: frame?.raw_category ?? topCategory?.categoryName ?? "None",
      confidence: frame?.confidence ?? topCategory?.score ?? 0,
      stableFrames: frame?.stability_frames ?? 0,
      target: target ?? "none"
    });

    if (!frame) return undefined;
    return {
      ...frame,
      target_palace_id: target
    };
  }

  function resolveTargetPalace(frame: GestureFrame | undefined, landmarks: LandmarkPoint[] | undefined): string | undefined {
    if (frame?.type === "point") {
      return targetPalaceFromPoint(landmarks?.[8], palacesRef.current) ?? targetPalaceIdRef.current;
    }
    return selectedPalaceIdRef.current;
  }

  function createLogFromFrame(frame: GestureFrame): GestureEventLog {
    return createGestureEventLog(frame.type, frame.confidence, actionForGesture(frame.type), frame.target_palace_id, {
      source: frame.source,
      raw_category: frame.raw_category,
      stability_frames: frame.stability_frames
    });
  }

  return (
    <section className="gesture-panel">
      <div className="panel-title-row">
        <Hand aria-hidden="true" size={18} />
        <h2>手势控制</h2>
      </div>
      <div className="camera-row">
        <button type="button" onClick={startCamera}>
          <Camera aria-hidden="true" size={16} />
          启用摄像头
        </button>
        <span className={`camera-status status-${cameraStatus}`}>
          {cameraStatus === "recognizing" ? "识别中" : cameraStatus === "loading" ? "加载识别模型" : cameraStatus === "unavailable" ? "使用替代控件" : "未启用"}
        </span>
      </div>
      <label className="sensitivity-row">
        识别精度
        <select value={sensitivity} onChange={(event) => setSensitivity(event.currentTarget.value as GestureSensitivity)}>
          {Object.entries(sensitivityLabels).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <video ref={videoRef} className="camera-preview" autoPlay muted playsInline aria-label="手势识别预览" />
      <dl className="recognition-debug" aria-label="实时手势识别状态">
        <div>
          <dt>原始手势</dt>
          <dd>{debug.rawCategory}</dd>
        </div>
        <div>
          <dt>置信度</dt>
          <dd>{Math.round(debug.confidence * 100)}%</dd>
        </div>
        <div>
          <dt>稳定帧</dt>
          <dd>{debug.stableFrames}</dd>
        </div>
        <div>
          <dt>点选目标</dt>
          <dd>{debug.target}</dd>
        </div>
      </dl>
      <div className="gesture-grid">
        {simulatedGestures.map((gesture) => (
          <button key={gesture.type} type="button" onClick={() => emitGesture(gesture.type)}>
            {gesture.type === "open_palm" ? <RotateCcw aria-hidden="true" size={15} /> : gesture.type === "pinch" ? <ZoomIn aria-hidden="true" size={15} /> : <MousePointer2 aria-hidden="true" size={15} />}
            {gesture.label}
          </button>
        ))}
      </div>
    </section>
  );
}
