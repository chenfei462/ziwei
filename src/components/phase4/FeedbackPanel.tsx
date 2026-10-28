"use client";

import { MessageSquare, Send } from "lucide-react";
import { useState } from "react";
import type { ClosedTestFeedbackResponse, FeedbackIssueCategory, FeedbackTaskId } from "../../types.js";

type FeedbackPanelProps = {
  sessionId: string;
  chartId: string;
  completedTasks: FeedbackTaskId[];
};

const issueOptions: Array<{ id: FeedbackIssueCategory; label: string }> = [
  { id: "blocking", label: "阻断问题" },
  { id: "major", label: "主要问题" },
  { id: "minor", label: "轻微问题" },
  { id: "content_review", label: "内容审查" },
  { id: "future_feature", label: "后续建议" }
];

const taskLabels: Record<FeedbackTaskId, string> = {
  create_chart: "建档开盘",
  select_palace: "点选宫位",
  switch_mode: "切换模式",
  open_trace: "查看溯源",
  gesture_or_fallback: "手势或按钮替代",
  submit_feedback: "提交反馈"
};

export function FeedbackPanel({ sessionId, chartId, completedTasks }: FeedbackPanelProps) {
  const [overall, setOverall] = useState(4);
  const [interpretationTrust, setInterpretationTrust] = useState(4);
  const [gestureUsability, setGestureUsability] = useState(3);
  const [shareWillingness, setShareWillingness] = useState(3);
  const [issueCategory, setIssueCategory] = useState<FeedbackIssueCategory>("minor");
  const [comment, setComment] = useState("");
  const [screenshotNote, setScreenshotNote] = useState("");
  const [consent, setConsent] = useState(false);
  const [status, setStatus] = useState<"idle" | "submitting" | "submitted" | "error">("idle");
  const [error, setError] = useState<string | undefined>();
  const [response, setResponse] = useState<ClosedTestFeedbackResponse | undefined>();

  async function submitFeedback() {
    setStatus("submitting");
    setError(undefined);

    try {
      const payload = {
        session_id: sessionId,
        chart_id: chartId,
        device: {
          type: getDeviceType(),
          browser: globalThis.navigator?.userAgent ?? "unknown",
          viewport: {
            width: globalThis.innerWidth ?? 0,
            height: globalThis.innerHeight ?? 0
          },
          camera_permission: "not_requested"
        },
        completed_tasks: [...new Set([...completedTasks, "submit_feedback"])],
        ratings: {
          overall,
          interpretation_trust: interpretationTrust,
          gesture_usability: gestureUsability,
          share_willingness: shareWillingness
        },
        issue_category: issueCategory,
        comment,
        screenshot_note: screenshotNote,
        consent: {
          agreed: consent,
          no_sensitive_birth_data: true,
          no_video_frame: true
        }
      };

      const submitted = await fetch("/api/ops/internal-feedback", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload)
      });
      const body = await submitted.json();
      if (!submitted.ok) {
        throw new Error(body.error?.message ?? "反馈提交失败");
      }

      setResponse(body as ClosedTestFeedbackResponse);
      setStatus("submitted");
      setComment("");
      setScreenshotNote("");
    } catch (caught) {
      setStatus("error");
      setError(caught instanceof Error ? caught.message : "反馈提交失败");
    }
  }

  return (
    <section className="feedback-panel" aria-label="封测反馈">
      <div className="panel-title-row">
        <MessageSquare aria-hidden="true" size={18} />
        <h2>封测反馈</h2>
      </div>
      <p className="muted">仅记录任务完成状态、设备环境、评分和文字说明；不上传摄像头画面，不保存完整出生资料。</p>
      <div className="task-chip-row" aria-label="已完成任务">
        {completedTasks.map((task) => (
          <span key={task}>{taskLabels[task]}</span>
        ))}
      </div>
      <div className="feedback-grid">
        <label>
          整体评分
          <select value={overall} onChange={(event) => setOverall(Number(event.target.value))}>
            {ratingOptions()}
          </select>
        </label>
        <label>
          解读可信度
          <select value={interpretationTrust} onChange={(event) => setInterpretationTrust(Number(event.target.value))}>
            {ratingOptions()}
          </select>
        </label>
        <label>
          手势可用性
          <select value={gestureUsability} onChange={(event) => setGestureUsability(Number(event.target.value))}>
            {ratingOptions()}
          </select>
        </label>
        <label>
          分享意愿
          <select value={shareWillingness} onChange={(event) => setShareWillingness(Number(event.target.value))}>
            {ratingOptions()}
          </select>
        </label>
      </div>
      <label>
        问题分类
        <select value={issueCategory} onChange={(event) => setIssueCategory(event.target.value as FeedbackIssueCategory)}>
          {issueOptions.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      <label>
        反馈内容
        <textarea value={comment} onChange={(event) => setComment(event.target.value)} placeholder="描述你完成了哪些任务、哪里卡住、哪段解读需要审查。" />
      </label>
      <label>
        截图说明
        <textarea value={screenshotNote} onChange={(event) => setScreenshotNote(event.target.value)} placeholder="只写截图说明，不上传图片文件。" />
      </label>
      <label className="checkbox-row">
        <input checked={consent} onChange={(event) => setConsent(event.target.checked)} type="checkbox" />
        我同意提交封测反馈，并确认不提交完整出生资料或摄像头画面。
      </label>
      <button className="primary-action" disabled={status === "submitting"} type="button" onClick={submitFeedback}>
        <Send aria-hidden="true" size={15} />
        提交反馈
      </button>
      {status === "submitted" ? (
        <p className="success-message">
          反馈已记录：<span className="mono">{response?.feedback_id}</span>
        </p>
      ) : null}
      {status === "error" ? <p className="error-message">{error}</p> : null}
    </section>
  );
}

function ratingOptions() {
  return [1, 2, 3, 4, 5].map((rating) => (
    <option key={rating} value={rating}>
      {rating}
    </option>
  ));
}

function getDeviceType(): "desktop" | "mobile" | "tablet" | "unknown" {
  const width = globalThis.innerWidth ?? 0;
  if (width > 0 && width < 700) return "mobile";
  if (width >= 700 && width < 1100) return "tablet";
  if (width >= 1100) return "desktop";
  return "unknown";
}
