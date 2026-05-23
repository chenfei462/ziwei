import { describe, expect, test } from "vitest";
import { POST as feedbackPost, GET as feedbackGet } from "../src/app/api/feedback/route.js";

describe("phase 4 feedback route handlers", () => {
  test("accept feedback and expose a privacy-preserving summary", async () => {
    const posted = await feedbackPost(
      new Request("http://local/api/feedback", {
        method: "POST",
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
          comment: "六宫解读可读，出生日期 1999-01-02 不应进入反馈。",
          screenshot_note: "仅记录文字说明。",
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

    const summaryResponse = await feedbackGet();
    const summary = await summaryResponse.json();
    expect(summaryResponse.status).toBe(200);
    expect(summary.total_feedback).toBeGreaterThanOrEqual(1);
    expect(summary.privacy.stores_video_frame).toBe(false);
  });
});
