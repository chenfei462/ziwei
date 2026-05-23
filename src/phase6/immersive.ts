import { ApiError } from "../errors.js";
import {
  appendImmersiveEvent,
  getChart,
  getImmersiveSessionRecord,
  listImmersiveEvents,
  saveImmersiveSession
} from "../store.js";
import {
  cameraPermissionStates,
  displayModes,
  feedbackDeviceTypes,
  immersiveStageEventTypes,
  type ARCapability,
  type CalibrationProfile,
  type ChartCreateResponse,
  type CreateImmersiveSessionRequest,
  type DisplayMode,
  type ImmersivePrivacy,
  type ImmersiveSession,
  type ImmersiveSessionResponse,
  type ImmersiveSessionSummary,
  type ImmersiveStageEventType,
  type ImmersiveStreamResponse,
  type StageEvent,
  type StageEventRequest,
  type StageEventResponse
} from "../types.js";

const privacy: ImmersivePrivacy = {
  hides_full_birth_date: true,
  hides_birth_time: true,
  hides_location_detail: true,
  stores_video_frame: false
};

const defaultCalibration: CalibrationProfile = {
  camera_permission: "not_requested",
  light_quality: "unknown",
  ar_supported: false,
  fallback_mode: "manual_panorama",
  no_video_frame: true
};

const layerOrder: ImmersiveSession["active_layer"][] = ["main", "support", "transforms"];
const fallbackPalaceIds = ["life", "career", "wealth", "spouse", "fortune", "migration", "siblings", "children", "health", "friends", "property", "parents"];

export function createImmersiveSession(request: CreateImmersiveSessionRequest): ImmersiveSessionResponse {
  validateCreateSessionRequest(request);
  requireChart(request.chart_id);

  const now = new Date();
  const ttlMinutes = normalizeTtl(request.ttl_minutes);
  const session: ImmersiveSession = {
    session_id: createId("immersive"),
    short_code: createShortCode(),
    chart_id: request.chart_id,
    display_mode: request.display_mode,
    created_at: now.toISOString(),
    expires_at: new Date(now.getTime() + ttlMinutes * 60_000).toISOString(),
    controller_label: request.controller_label ? sanitizeImmersiveText(request.controller_label).slice(0, 80) : undefined,
    active_layer: "main",
    active_major_period_index: 0,
    interpretation_mode: "professional",
    is_panorama: false,
    event_count: 0,
    privacy,
    calibration: defaultCalibration
  };

  saveImmersiveSession(session);
  return { session, privacy };
}

export function getImmersiveSession(sessionId: string): ImmersiveSession | undefined {
  const session = getImmersiveSessionRecord(sessionId);
  if (!session || isExpired(session)) return undefined;
  return session;
}

export function recordStageEvent(sessionId: string, request: StageEventRequest): StageEventResponse {
  validateStageEventRequest(request);
  const session = resolveImmersiveSession(sessionId, request.session_snapshot);
  const chart = getChart(session.chart_id);
  const updatedSession = applyStageEvent(session, chart, request);
  const event: StageEvent = {
    event_id: createId("stage_event"),
    session_id: session.session_id,
    type: request.type,
    timestamp: new Date().toISOString(),
    target_palace_id: request.target_palace_id,
    confidence: normalizeConfidence(request.confidence),
    gesture_type: request.gesture_type,
    action: actionForEvent(request.type),
    note: request.note ? sanitizeImmersiveText(request.note) : undefined,
    no_video_frame: true
  };

  saveImmersiveSession(updatedSession);
  appendImmersiveEvent(event);
  return {
    session: updatedSession,
    event,
    privacy
  };
}

export function getImmersiveStream(sessionId: string): ImmersiveStreamResponse {
  const session = requireImmersiveSession(sessionId);
  return {
    session,
    events: listImmersiveEvents(sessionId),
    performance_targets: performanceTargets(),
    privacy
  };
}

export function summarizeImmersiveSession(sessionId: string): ImmersiveSessionSummary {
  const stream = getImmersiveStream(sessionId);
  return {
    session_id: stream.session.session_id,
    display_mode: stream.session.display_mode,
    event_count: stream.events.length,
    active_palace_id: stream.session.active_palace_id,
    active_layer: stream.session.active_layer,
    active_major_period_index: stream.session.active_major_period_index,
    interpretation_mode: stream.session.interpretation_mode,
    is_panorama: stream.session.is_panorama,
    performance_targets: stream.performance_targets,
    privacy: stream.privacy
  };
}

export function mapImmersiveGesture(gestureType: NonNullable<StageEventRequest["gesture_type"]>, confidence: number): StageEventRequest {
  const map: Record<NonNullable<StageEventRequest["gesture_type"]>, ImmersiveStageEventType> = {
    open_palm: "reset_view",
    point: "select_palace",
    pinch: "cycle_layer",
    circle: "cycle_major_period",
    fist: "reset_view",
    two_hand_spread: "enter_panorama",
    palm_flip: "toggle_mode"
  };
  return {
    type: map[gestureType],
    confidence,
    gesture_type: gestureType
  };
}

export function detectARCapability(input: {
  webxr_supported: boolean;
  camera_permission: ARCapability["camera_permission"];
  device_type: ARCapability["device_type"];
}): ARCapability {
  if (!cameraPermissionStates.includes(input.camera_permission)) {
    throw new ApiError("INVALID_CAMERA_PERMISSION", "camera_permission is invalid.", { field: "camera_permission" });
  }
  if (!feedbackDeviceTypes.includes(input.device_type)) {
    throw new ApiError("INVALID_DEVICE_TYPE", "device_type is invalid.", { field: "device_type" });
  }
  const ready = input.webxr_supported && input.camera_permission === "granted";
  return {
    status: ready ? "ready" : "fallback",
    webxr_supported: input.webxr_supported,
    camera_permission: input.camera_permission,
    device_type: input.device_type,
    fallback_mode: ready ? "none" : "manual_panorama",
    no_video_frame: true
  };
}

function validateCreateSessionRequest(request: CreateImmersiveSessionRequest): void {
  if (!request?.chart_id) {
    throw new ApiError("IMMERSIVE_CHART_REQUIRED", "chart_id is required.", { field: "chart_id" });
  }
  if (!displayModes.includes(request.display_mode)) {
    throw new ApiError("INVALID_DISPLAY_MODE", "display_mode is invalid.", { field: "display_mode" });
  }
}

function validateStageEventRequest(request: StageEventRequest): void {
  if (!request || !immersiveStageEventTypes.includes(request.type)) {
    throw new ApiError("INVALID_STAGE_EVENT_TYPE", "stage event type is invalid.", { field: "type" });
  }
}

function requireChart(chartId: string): ChartCreateResponse {
  const chart = getChart(chartId);
  if (!chart) {
    throw new ApiError("CHART_NOT_FOUND", "chart not found.", { field: "chart_id", status: 404 });
  }
  return chart;
}

function requireImmersiveSession(sessionId: string): ImmersiveSession {
  return resolveImmersiveSession(sessionId);
}

function resolveImmersiveSession(sessionId: string, sessionSnapshot?: ImmersiveSession): ImmersiveSession {
  const session = getImmersiveSession(sessionId);
  if (session) return session;
  if (sessionSnapshot?.session_id === sessionId && !isExpired(sessionSnapshot)) {
    return {
      ...sessionSnapshot,
      privacy,
      calibration: {
        ...sessionSnapshot.calibration,
        no_video_frame: true
      }
    };
  }
  throw new ApiError("IMMERSIVE_SESSION_NOT_FOUND", "immersive session not found or expired.", { field: "session_id", status: 404 });
}

function applyStageEvent(session: ImmersiveSession, chart: ChartCreateResponse | undefined, request: StageEventRequest): ImmersiveSession {
  const next: ImmersiveSession = { ...session, event_count: session.event_count + 1 };

  if (request.type === "select_palace") {
    const isKnownPalace = chart
      ? chart.chart.palaces.some((palace) => palace.palace_id === request.target_palace_id)
      : fallbackPalaceIds.includes(request.target_palace_id ?? "");
    if (!request.target_palace_id || !isKnownPalace) {
      throw new ApiError("PALACE_NOT_FOUND", "palace not found.", { field: "target_palace_id", status: 404 });
    }
    return { ...next, active_palace_id: request.target_palace_id };
  }

  if (request.type === "cycle_layer") {
    const currentIndex = layerOrder.indexOf(session.active_layer);
    return { ...next, active_layer: layerOrder[(currentIndex + 1) % layerOrder.length] };
  }

  if (request.type === "cycle_major_period") {
    const majorPeriodCount = chart?.chart.major_periods.length ?? 12;
    return { ...next, active_major_period_index: (session.active_major_period_index + 1) % majorPeriodCount };
  }

  if (request.type === "reset_view") {
    return { ...next, active_palace_id: undefined, active_layer: "main", active_major_period_index: 0, is_panorama: false };
  }

  if (request.type === "enter_panorama") {
    return { ...next, is_panorama: true };
  }

  if (request.type === "toggle_mode") {
    return { ...next, interpretation_mode: session.interpretation_mode === "professional" ? "entertainment" : "professional" };
  }

  return next;
}

function actionForEvent(type: ImmersiveStageEventType): string {
  const actions: Record<ImmersiveStageEventType, string> = {
    select_palace: "select_palace",
    cycle_layer: "cycle_star_layer",
    cycle_major_period: "cycle_major_period",
    reset_view: "reset_view",
    enter_panorama: "enter_panorama",
    toggle_mode: "toggle_interpretation_mode",
    create_share_card: "create_share_card"
  };
  return actions[type];
}

function normalizeTtl(ttlMinutes: number | undefined): number {
  if (ttlMinutes === undefined) return 45;
  if (!Number.isInteger(ttlMinutes) || ttlMinutes < 5 || ttlMinutes > 240) {
    throw new ApiError("INVALID_IMMERSIVE_TTL", "ttl_minutes must be an integer from 5 to 240.", { field: "ttl_minutes" });
  }
  return ttlMinutes;
}

function normalizeConfidence(confidence: number | undefined): number {
  if (confidence === undefined) return 1;
  return Math.max(0, Math.min(1, Math.round(confidence * 100) / 100));
}

function sanitizeImmersiveText(text: string): string {
  return String(text ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\d{4}[-/]\d{1,2}[-/]\d{1,2}\b/g, "[birth_date_redacted]")
    .replace(/\b(?:[01]?\d|2[0-3]):[0-5]\d\b/g, "[birth_time_redacted]")
    .replace(/\b(?:Shanghai|Beijing|Guangzhou|Shenzhen|Chengdu|Hangzhou|Nanjing|Wuhan)\b/gi, "[location_redacted]")
    .replace(/data:image\/[a-zA-Z+.-]+;base64,[A-Za-z0-9+/=]+/g, "[image_payload_redacted]")
    .slice(0, 800);
}

function isExpired(session: ImmersiveSession): boolean {
  return Date.parse(session.expires_at) <= Date.now();
}

function performanceTargets(): ImmersiveStreamResponse["performance_targets"] {
  return {
    sync_latency_ms: 250,
    ar_startup_ms: 3000,
    stage_min_fps: 30
  };
}

function createShortCode(): string {
  return Math.random().toString(36).replace(/[^a-z0-9]/gi, "").slice(2, 8).toUpperCase().padEnd(6, "0");
}

function createId(prefix: string): string {
  return `${prefix}_${new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14)}_${Math.random().toString(36).slice(2, 8)}`;
}
