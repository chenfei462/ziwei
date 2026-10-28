// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { FeedbackPanel } from "../src/components/phase4/FeedbackPanel.js";
import { ClosedTestNotice } from "../src/components/phase4/ClosedTestNotice.js";

describe("internal feedback UI", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  test("renders closed-test consent copy and submits sanitized feedback payload", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({
        feedback_id: "fb_demo",
        session_id: "session_ui",
        sanitized_feedback: {
          comment: "流程清楚"
        },
        metrics_snapshot: {
          completion_rate: 1,
          share_willingness_rate: 1
        },
        privacy: {
          stores_video_frame: false
        }
      })
    } as Response);

    render(
      <FeedbackPanel
        chartId="chart_ui"
        completedTasks={["create_chart", "select_palace", "switch_mode", "open_trace", "gesture_or_fallback"]}
        sessionId="session_ui"
      />
    );

    expect(screen.getByRole("heading", { name: "封测反馈" })).toBeInTheDocument();
    expect(screen.getByText(/不上传摄像头画面/)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("整体评分"), { target: { value: "5" } });
    fireEvent.change(screen.getByLabelText("分享意愿"), { target: { value: "4" } });
    fireEvent.change(screen.getByLabelText("问题分类"), { target: { value: "minor" } });
    fireEvent.change(screen.getByLabelText("反馈内容"), { target: { value: "流程清楚，愿意继续测试。" } });
    fireEvent.click(screen.getByLabelText(/我同意提交封测反馈/));
    fireEvent.click(screen.getByRole("button", { name: "提交反馈" }));

    await waitFor(() => expect(screen.getByText(/反馈已记录/)).toBeInTheDocument());
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/ops/internal-feedback",
      expect.objectContaining({
        method: "POST",
        headers: { "content-type": "application/json" },
        body: expect.stringContaining('"no_video_frame":true')
      })
    );
  });

  test("renders the MVP closed-test notice and privacy baseline", () => {
    render(<ClosedTestNotice />);

    expect(screen.getByRole("heading", { name: "封测说明" })).toBeInTheDocument();
    expect(screen.getByText(/50-100 名用户/)).toBeInTheDocument();
    expect(screen.getByText(/不采集摄像头画面/)).toBeInTheDocument();
  });
});
