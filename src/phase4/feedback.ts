import { ApiError } from "../errors.js";
import { listFeedback, saveFeedback } from "../store.js";
import {
  cameraPermissionStates,
  feedbackDeviceTypes,
  feedbackIssueCategories,
  feedbackTaskIds,
  type ClosedTestFeedbackRecord,
  type ClosedTestFeedbackRequest,
  type ClosedTestFeedbackResponse,
  type ClosedTestMetricsSummary,
  type ClosedTestPrivacy,
  type ClosedTestRatings,
  type FeedbackIssueCategory,
  type FeedbackTaskId
} from "../types.js";

const privacy: ClosedTestPrivacy = {
  stores_full_birth_date: false,
  stores_birth_time: false,
  stores_location_detail: false,
  stores_video_frame: false
};

export function submitClosedTestFeedback(request: ClosedTestFeedbackRequest): ClosedTestFeedbackResponse {
  validateFeedbackRequest(request);

  const feedbackId = createFeedbackId();
  const receivedAt = new Date().toISOString();
  const sessionId = request.session_id?.trim() || createSessionId();
  const record: ClosedTestFeedbackRecord = {
    feedback_id: feedbackId,
    session_id: sessionId,
    chart_id: request.chart_id?.trim() || undefined,
    received_at: receivedAt,
    device: {
      type: request.device.type,
      browser: sanitizeText(request.device.browser ?? "").slice(0, 120) || undefined,
      viewport: request.device.viewport,
      camera_permission: request.device.camera_permission
    },
    completed_tasks: uniqueTasks(request.completed_tasks),
    ratings: normalizeRatings(request.ratings),
    issue_category: request.issue_category,
    comment: sanitizeFeedbackText(request.comment),
    screenshot_note: request.screenshot_note ? sanitizeFeedbackText(request.screenshot_note) : undefined,
    consent: request.consent
  };

  saveFeedback(record);

  return {
    feedback_id: feedbackId,
    session_id: sessionId,
    received_at: receivedAt,
    sanitized_feedback: record,
    metrics_snapshot: summarizeClosedTestFeedback(),
    privacy
  };
}

export function summarizeClosedTestFeedback(): ClosedTestMetricsSummary {
  const records = listFeedback();
  const total = records.length;
  const issueCounts = createIssueCounts();

  for (const record of records) {
    issueCounts[record.issue_category] += 1;
  }

  return {
    total_feedback: total,
    completion_rate: total ? round2(records.filter((record) => isCompleteFlow(record.completed_tasks)).length / total) : 0,
    share_willingness_rate: total ? round2(records.filter((record) => record.ratings.share_willingness >= 4).length / total) : 0,
    average_ratings: averageRatings(records),
    issue_counts: issueCounts,
    phase_exit_targets: {
      completion_rate_target: 0.6,
      share_willingness_target: 0.2
    },
    privacy
  };
}

function validateFeedbackRequest(request: ClosedTestFeedbackRequest): void {
  if (!request?.consent?.agreed) {
    throw new ApiError("FEEDBACK_CONSENT_REQUIRED", "提交封测反馈前需要用户同意。", { field: "consent.agreed" });
  }
  if (request.consent.no_sensitive_birth_data !== true || request.consent.no_video_frame !== true) {
    throw new ApiError("FEEDBACK_PRIVACY_GUARD_REQUIRED", "反馈必须确认不提交完整出生资料或摄像头画面。", { field: "consent" });
  }
  if (!feedbackIssueCategories.includes(request.issue_category)) {
    throw new ApiError("INVALID_FEEDBACK_CATEGORY", "反馈问题分类无效。", { field: "issue_category" });
  }
  if (!request.device || !feedbackDeviceTypes.includes(request.device.type)) {
    throw new ApiError("INVALID_FEEDBACK_DEVICE", "反馈设备类型无效。", { field: "device.type" });
  }
  if (!cameraPermissionStates.includes(request.device.camera_permission)) {
    throw new ApiError("INVALID_CAMERA_PERMISSION", "摄像头权限状态无效。", { field: "device.camera_permission" });
  }
  for (const task of request.completed_tasks) {
    if (!feedbackTaskIds.includes(task)) {
      throw new ApiError("INVALID_FEEDBACK_TASK", "反馈任务 ID 无效。", { field: "completed_tasks" });
    }
  }
  normalizeRatings(request.ratings);
}

function normalizeRatings(ratings: ClosedTestRatings): ClosedTestRatings {
  return {
    overall: normalizeRating(ratings.overall, "ratings.overall"),
    interpretation_trust: normalizeRating(ratings.interpretation_trust, "ratings.interpretation_trust"),
    gesture_usability: normalizeRating(ratings.gesture_usability, "ratings.gesture_usability"),
    share_willingness: normalizeRating(ratings.share_willingness, "ratings.share_willingness")
  };
}

function normalizeRating(value: number, field: string): number {
  if (!Number.isInteger(value) || value < 1 || value > 5) {
    throw new ApiError("INVALID_FEEDBACK_RATING", "反馈评分必须是 1 到 5 的整数。", { field });
  }
  return value;
}

function sanitizeFeedbackText(text: string): string {
  return sanitizeText(text)
    .replace(/\b\d{4}[-/年]\d{1,2}[-/月]\d{1,2}日?\b/g, "[birth_date_redacted]")
    .replace(/\b(?:[01]?\d|2[0-3]):[0-5]\d\b/g, "[birth_time_redacted]")
    .replace(/data:image\/[a-zA-Z+.-]+;base64,[A-Za-z0-9+/=]+/g, "[image_payload_redacted]")
    .slice(0, 800);
}

function sanitizeText(text: string): string {
  return String(text ?? "").replace(/\s+/g, " ").trim();
}

function uniqueTasks(tasks: readonly FeedbackTaskId[]): FeedbackTaskId[] {
  return [...new Set(tasks)];
}

function isCompleteFlow(tasks: FeedbackTaskId[]): boolean {
  return feedbackTaskIds.every((taskId) => tasks.includes(taskId));
}

function createIssueCounts(): Record<FeedbackIssueCategory, number> {
  return Object.fromEntries(feedbackIssueCategories.map((category) => [category, 0])) as Record<FeedbackIssueCategory, number>;
}

function averageRatings(records: ClosedTestFeedbackRecord[]): ClosedTestRatings {
  if (!records.length) {
    return {
      overall: 0,
      interpretation_trust: 0,
      gesture_usability: 0,
      share_willingness: 0
    };
  }

  return {
    overall: average(records.map((record) => record.ratings.overall)),
    interpretation_trust: average(records.map((record) => record.ratings.interpretation_trust)),
    gesture_usability: average(records.map((record) => record.ratings.gesture_usability)),
    share_willingness: average(records.map((record) => record.ratings.share_willingness))
  };
}

function average(values: number[]): number {
  return round2(values.reduce((total, value) => total + value, 0) / values.length);
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function createFeedbackId(): string {
  return `fb_${new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14)}_${Math.random().toString(36).slice(2, 8)}`;
}

function createSessionId(): string {
  return `session_${Math.random().toString(36).slice(2, 10)}`;
}
