// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { AccountUpgradeForm } from "../src/app/account/AccountUpgradeForm.js";

const smsSend = {
  challenge_id: "sms_challenge_component",
  masked_phone: "138****8000",
  expires_at: "2026-05-31T12:00:00.000Z",
  delivery: {
    provider: "mock_sms",
    status: "mock_sent",
    external_delivery_required: false
  }
};

const smsLogin = {
  user: {
    member_id: "member_phone_component",
    display_name: "正式用户",
    phone_hash: "sha256:component"
  },
  migrated: {
    chart_ids: ["chart_component"]
  },
  session: {
    http_only_cookie: true,
    max_age_seconds: 15552000
  }
};

const boundAccount = {
  user: {
    member_id: "member_bound_component",
    display_name: "绑定用户",
    email_hash: "sha256:email"
  },
  migrated: {
    chart_ids: []
  }
};

describe("account login UI", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  test("sends SMS code, logs in, and keeps sensitive values out of rendered status", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce({ ok: true, json: async () => smsSend } as Response)
      .mockResolvedValueOnce({ ok: true, json: async () => smsLogin } as Response);

    render(<AccountUpgradeForm />);

    fireEvent.change(screen.getByLabelText("登录手机号"), { target: { value: "13800138000" } });
    fireEvent.click(screen.getByRole("button", { name: "获取验证码" }));
    await waitFor(() => expect(screen.getByText(/验证码已发送至 138\*\*\*\*8000/)).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText("验证码"), { target: { value: "246810" } });
    fireEvent.change(screen.getByLabelText("登录昵称"), { target: { value: "正式用户" } });
    fireEvent.click(screen.getByRole("button", { name: "登录并迁移匿名资料" }));
    await waitFor(() => expect(screen.getByText("已登录为 正式用户，已迁移命盘 1 个。")).toBeInTheDocument());

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/account/sms/send",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ phone: "13800138000" })
      })
    );
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/account/sms/login",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ phone: "13800138000", code: "246810", display_name: "正式用户" })
      })
    );
    expect(screen.queryByText("246810")).not.toBeInTheDocument();
    expect(screen.queryByText("13800138000")).not.toBeInTheDocument();
  });

  test("keeps the legacy anonymous binding entry available for support recovery", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({ ok: true, json: async () => boundAccount } as Response);

    render(<AccountUpgradeForm />);

    fireEvent.change(screen.getByLabelText("邮箱"), { target: { value: "user@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: "绑定当前匿名资料" }));
    await waitFor(() => expect(screen.getByText("账号已绑定：member_bound_component，已迁移命盘 0 个。")).toBeInTheDocument());

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/account/upgrade",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          email: "user@example.com",
          phone: undefined,
          display_name: undefined
        })
      })
    );
    expect(screen.queryByText("user@example.com")).not.toBeInTheDocument();
  });
});
