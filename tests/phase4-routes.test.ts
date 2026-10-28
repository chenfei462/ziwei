import { describe, expect, test } from "vitest";
import { GET as feedbackGet, POST as feedbackPost } from "../src/app/api/ops/internal-feedback/route.js";

const opsHeaders = {
  "content-type": "application/json",
  "x-admin-token": "phase10_admin_token",
  "x-admin-role": "ops_admin",
  "x-admin-actor": "internal_feedback_route_test"
};

describe("internal feedback route handlers", () => {
  test("accept feedback and expose a privacy-preserving summary behind ops auth", async () => {
    const posted = await feedbackPost(
      new Request("http://local/api/ops/internal-feedback", {
        method: "POST",
        headers: opsHeaders,
        body: JSON.stringify({
          session_id: "session_route",
          chart_id: "chart_route",
          device: {
            type: "mobile",
            browser: "webkit",
            viewport: { width: 390, height: 844 },
            camera_permission: "denied"
          },
          completed_tasks: ["create_chart", "select_palace", "switch_mode", "open_trace", "gesture_or_fallback", "submit_feedback"],
          ratings: {
            overall: 4,
            interpretation_trust: 4,
            gesture_usability: 3,
            share_willingness: 4
          },
          issue_category: "content_review",
          comment: "Palace reading is clear; birth date 1999-01-02 must be redacted.",
          screenshot_note: "Text-only note.",
          consent: {
            agreed: true,
            no_sensitive_birth_data: true,
            no_video_frame: true
          }
        })
      })
    );
    const postedBody = await posted.json();

    expect(posted.status).toBe(201);
    expect(postedBody.sanitized_feedback.comment).toContain("[birth_date_redacted]");

    const summaryResponse = await feedbackGet(
      new Request("http://local/api/ops/internal-feedback", {
        headers: opsHeaders
      })
    );
    const summary = await summaryResponse.json();
    expect(summaryResponse.status).toBe(200);
    expect(summary.total_feedback).toBeGreaterThanOrEqual(1);
    expect(summary.privacy.stores_video_frame).toBe(false);
  });

  test("rejects internal feedback writes without ops credentials", async () => {
    const response = await feedbackPost(
      new Request("http://local/api/ops/internal-feedback", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          session_id: "session_missing_auth",
          chart_id: "chart_missing_auth",
          device: {
            type: "desktop",
            browser: "chromium",
            viewport: { width: 1440, height: 980 },
            camera_permission: "not_requested"
          },
          completed_tasks: ["create_chart"],
          ratings: {
            overall: 4,
            interpretation_trust: 4,
            gesture_usability: 4,
            share_willingness: 4
          },
          issue_category: "minor",
          comment: "No auth.",
          consent: {
            agreed: true,
            no_sensitive_birth_data: true,
            no_video_frame: true
          }
        })
      })
    );
    const payload = await response.json();

    expect(response.status).toBe(401);
    expect(payload.error.code).toBe("OPS_AUTH_REQUIRED");
  });
});
