import type { Chart, MajorPeriod, Palace, TransformType } from "../types.js";

export type StarLayer = "main" | "support" | "transforms";

export type RelationKind = "selected" | "opposite" | "triad" | "neighbor" | "inactive";

export type PalaceViewModel = Palace & {
  label: string;
  position: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  relationKind: RelationKind;
  displayStars: string[];
};

export type ChartViewModel = {
  palaces: PalaceViewModel[];
  palaceById: Record<string, PalaceViewModel>;
  transforms: Chart["transforms"];
  majorPeriods: MajorPeriod[];
  activeMajorPeriod: MajorPeriod | undefined;
};

export type InteractionStatus =
  | "idle"
  | "selected_palace"
  | "zoomed_layer"
  | "major_period_active"
  | "gesture_preview"
  | "gesture_confirmed"
  | "cooldown";

export type GestureType = "open_palm" | "point" | "pinch" | "circle" | "fist";

export type GestureAction = "reset_view" | "select_palace" | "cycle_layer" | "cycle_major_period" | "go_back";

export type GestureSensitivity = "responsive" | "balanced" | "strict";

export type GestureSource = "camera" | "simulation";

export type GestureEventLog = {
  id: string;
  type: GestureType;
  confidence: number;
  timestamp: string;
  action: GestureAction;
  target_palace_id?: string;
  source: GestureSource;
  raw_category?: string;
  stability_frames?: number;
  no_video_frame: true;
  status: "preview" | "confirmed" | "rejected";
};

export type InteractionState = {
  status: InteractionStatus;
  selectedPalaceId?: string;
  activeLayer: StarLayer;
  activeMajorPeriodIndex: number;
  logs: GestureEventLog[];
  cooldownUntil?: number;
};

export type GestureFrame = {
  type: GestureType;
  confidence: number;
  source: GestureSource;
  raw_category?: string;
  stability_frames?: number;
  target_palace_id?: string;
};

export type TransformDisplay = {
  type: TransformType;
  label: string;
};
