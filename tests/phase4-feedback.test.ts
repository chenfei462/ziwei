import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test, beforeEach } from "vitest";
import { clearFeedbackForTests, resolvePersistentStoreDirForRuntime } from "../src/store.js";
import { submitClosedTestFeedback, summarizeClosedTestFeedback } from "../src/phase4/feedback.js";
import type { ClosedTestFeedbackRequest, FeedbackIssueCategory } from "../src/types.js";

const validFeedback: ClosedTestFeedbackRequest = {
  session_id: "session_demo",
  chart_id: "chart_demo",
  device: {
    type: "desktop" as const,
    browser: "chromium",
    viewport: { width: 1440, height: 980 },
    camera_permission: "not_requested" as const
  },
  completed_tasks: ["create_chart", "select_palace", "switch_mode", "open_trace", "gesture_or_fallback", "submit_feedback"] as const,
  ratings: {
    overall: 5,
    interpretation_trust: 4,
    gesture_usability: 4,
    share_willingness: 5
  },
  issue_category: "minor" as const,
  comment: "流程完整。我的生日是 2000-08-16，时间 03:30，反馈里不应该保留。",
  screenshot_note: "右侧反馈面板可见，没有上传截图文件。",
  consent: {
    agreed: true,
    no_sensitive_birth_data: true,
    no_video_frame: true
  }
};

describe("phase 4 closed-test feedback", () => {
  beforeEach(() => {
    clearFeedbackForTests();
  });

  test("stores sanitized feedback without full birth date, birth time, or video-frame payload", () => {
    const response = submitClosedTestFeedback(validFeedback);

    expect(response.feedback_id).toMatch(/^fb_/);
    expect(response.sanitized_feedback.comment).toContain("[birth_date_redacted]");
    expect(response.sanitized_feedback.comment).toContain("[birth_time_redacted]");
    expect(response.sanitized_feedback.comment).not.toContain("2000-08-16");
    expect(response.sanitized_feedback.comment).not.toContain("03:30");
    expect(response.privacy).toEqual({
      stores_full_birth_date: false,
      stores_birth_time: false,
      stores_location_detail: false,
      stores_video_frame: false
    });
  });

  test("persists sanitized feedback records outside memory storage", () => {
    const response = submitClosedTestFeedback(validFeedback);
    const bucketDir = join(
      resolvePersistentStoreDirForRuntime({
        cwd: process.cwd(),
        nodeEnv: process.env.NODE_ENV,
        processId: process.pid,
        storeDir: process.env.ZIWEI_STORE_DIR
      }),
      "feedback"
    );
    const files = existsSync(bucketDir) ? readdirSync(bucketDir).filter((name) => name.endsWith(".json")) : [];
    const persisted = files.map((name) => JSON.parse(readFileSync(join(bucketDir, name), "utf8")) as { feedback_id?: string; comment?: string });

    expect(persisted).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          feedback_id: response.feedback_id,
          comment: expect.stringContaining("[birth_date_redacted]")
        })
      ])
    );
    expect(JSON.stringify(persisted)).not.toContain("2000-08-16");
    expect(JSON.stringify(persisted)).not.toContain("03:30");

    clearFeedbackForTests();
    expect(existsSync(bucketDir)).toBe(false);
  });

  test("summarizes completion, share willingness, issue categories, and phase exit targets", () => {
    submitClosedTestFeedback(validFeedback);
    submitClosedTestFeedback({
      ...validFeedback,
      session_id: "session_second",
      issue_category: "major",
      completed_tasks: ["create_chart", "select_palace", "submit_feedback"],
      ratings: {
        overall: 3,
        interpretation_trust: 3,
        gesture_usability: 2,
        share_willingness: 2
      }
    });

    const summary = summarizeClosedTestFeedback();

    expect(summary.total_feedback).toBe(2);
    expect(summary.completion_rate).toBe(0.5);
    expect(summary.share_willingness_rate).toBe(0.5);
    expect(summary.issue_counts).toMatchObject({ minor: 1, major: 1 });
    expect(summary.phase_exit_targets).toMatchObject({
      completion_rate_target: 0.6,
      share_willingness_target: 0.2
    });
  });

  test("rejects feedback without consent and invalid issue categories", () => {
    let consentError: unknown;
    try {
      submitClosedTestFeedback({
        ...validFeedback,
        consent: { ...validFeedback.consent, agreed: false }
      });
    } catch (error) {
      consentError = error;
    }

    let categoryError: unknown;
    try {
      submitClosedTestFeedback({
        ...validFeedback,
        issue_category: "security" as FeedbackIssueCategory
      });
    } catch (error) {
      categoryError = error;
    }

    expect(consentError).toMatchObject({ code: "FEEDBACK_CONSENT_REQUIRED", field: "consent.agreed" });
    expect(categoryError).toMatchObject({ code: "INVALID_FEEDBACK_CATEGORY", field: "issue_category" });
  });
});
