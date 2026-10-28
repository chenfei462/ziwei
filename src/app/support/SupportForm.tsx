"use client";

import { Headset, Send } from "lucide-react";
import { type FormEvent, useState } from "react";

export function SupportForm() {
  const [status, setStatus] = useState<string>();
  const [error, setError] = useState<string>();

  async function submitTicket(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus(undefined);
    setError(undefined);
    const form = new FormData(event.currentTarget);
    const payload = {
      order_id: optionalText(form.get("order_id")),
      report_id: optionalText(form.get("report_id")),
      category: String(form.get("category") || "general"),
      priority: String(form.get("priority") || "normal"),
      subject: String(form.get("subject") || "").trim(),
      message: String(form.get("message") || "").trim(),
      consent: {
        agreed: form.get("agreed") === "on",
        no_sensitive_birth_data: form.get("no_sensitive_birth_data") === "on"
      }
    };

    try {
      const response = await fetch("/api/support/ticket", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload)
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error?.message ?? "提交失败，请稍后重试。");
      setStatus(`工单已提交：${body.ticket_id}`);
      event.currentTarget.reset();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "提交失败，请稍后重试。");
    }
  }

  return (
    <form className="public-form-card" onSubmit={submitTicket}>
      <div className="panel-title-row">
        <Headset aria-hidden="true" size={18} />
        <h2>提交客服问题</h2>
      </div>
      <div className="public-form-grid">
        <label>
          问题类型
          <select name="category" defaultValue="general">
            <option value="general">一般问题</option>
            <option value="payment_failed">支付失败</option>
            <option value="unfulfilled">权益未到账</option>
            <option value="refund_request">退款申请</option>
            <option value="content_dispute">内容反馈</option>
            <option value="privacy_deletion">隐私删除</option>
          </select>
        </label>
        <label>
          优先级
          <select name="priority" defaultValue="normal">
            <option value="low">低</option>
            <option value="normal">普通</option>
            <option value="high">高</option>
            <option value="urgent">紧急</option>
          </select>
        </label>
        <label>
          订单号
          <input name="order_id" placeholder="可选" />
        </label>
        <label>
          报告号
          <input name="report_id" placeholder="可选" />
        </label>
        <label>
          主题
          <input name="subject" placeholder="例如：报告权益未到账" required />
        </label>
      </div>
      <label>
        问题描述
        <textarea name="message" placeholder="请不要提交完整出生日期、出生时间或精确地点。" required />
      </label>
      <div className="public-check-grid">
        <label className="checkbox-row">
          <input name="agreed" required type="checkbox" />
          我同意客服处理必要的订单、报告和反馈信息
        </label>
        <label className="checkbox-row">
          <input name="no_sensitive_birth_data" required type="checkbox" />
          我确认不会在工单中提交完整出生资料或身份证明信息
        </label>
      </div>
      {status ? <p className="success-message">{status}</p> : null}
      {error ? <p className="error-message">{error}</p> : null}
      <button className="public-submit-button" type="submit">
        <Send aria-hidden="true" size={18} />
        提交工单
      </button>
    </form>
  );
}

function optionalText(value: FormDataEntryValue | null): string | undefined {
  const text = String(value ?? "").trim();
  return text || undefined;
}
