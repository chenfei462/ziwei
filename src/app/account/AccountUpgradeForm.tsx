"use client";

import { KeyRound, LogIn, ShieldCheck, Smartphone } from "lucide-react";
import { type FormEvent, useState } from "react";

type SmsSendResponse = {
  challenge_id?: string;
  masked_phone?: string;
  expires_at?: string;
  delivery?: {
    provider: string;
    status: string;
    external_delivery_required: boolean;
  };
  error?: {
    message?: string;
  };
};

type AccountLoginResponse = {
  user?: {
    member_id: string;
    display_name: string;
    email_hash?: string;
    phone_hash?: string;
  };
  migrated?: {
    chart_ids: string[];
  };
  session?: {
    http_only_cookie: true;
    max_age_seconds: number;
  };
  error?: {
    message?: string;
  };
};

export function AccountUpgradeForm() {
  const [phone, setPhone] = useState("");
  const [smsStatus, setSmsStatus] = useState<string>();
  const [status, setStatus] = useState<string>();
  const [error, setError] = useState<string>();
  const [isSending, setIsSending] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isBinding, setIsBinding] = useState(false);

  async function sendSms(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSmsStatus(undefined);
    setStatus(undefined);
    setError(undefined);
    setIsSending(true);

    try {
      const response = await fetch("/api/account/sms/send", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ phone })
      });
      const payload = (await response.json()) as SmsSendResponse;
      if (!response.ok || !payload.challenge_id || !payload.masked_phone) {
        throw new Error(payload.error?.message ?? "验证码发送失败，请稍后重试。");
      }
      setSmsStatus(`验证码已发送至 ${payload.masked_phone}，5 分钟内有效。`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "验证码发送失败，请稍后重试。");
    } finally {
      setIsSending(false);
    }
  }

  async function loginWithSms(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus(undefined);
    setError(undefined);
    setIsLoggingIn(true);
    const form = new FormData(event.currentTarget);

    try {
      const response = await fetch("/api/account/sms/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          phone,
          code: requiredText(form.get("code")),
          display_name: optionalText(form.get("display_name"))
        })
      });
      const payload = (await response.json()) as AccountLoginResponse;
      if (!response.ok || !payload.user) {
        throw new Error(payload.error?.message ?? "登录失败，请检查验证码。");
      }
      setStatus(`已登录为 ${payload.user.display_name}，已迁移命盘 ${payload.migrated?.chart_ids.length ?? 0} 个。`);
      event.currentTarget.reset();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "登录失败，请检查验证码。");
    } finally {
      setIsLoggingIn(false);
    }
  }

  async function bindAnonymous(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus(undefined);
    setError(undefined);
    setIsBinding(true);
    const form = new FormData(event.currentTarget);

    try {
      const response = await fetch("/api/account/upgrade", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email: optionalText(form.get("email")),
          phone: optionalText(form.get("phone")),
          display_name: optionalText(form.get("display_name"))
        })
      });
      const payload = (await response.json()) as AccountLoginResponse;
      if (!response.ok || !payload.user) {
        throw new Error(payload.error?.message ?? "账号绑定失败，请稍后重试。");
      }
      setStatus(`账号已绑定：${payload.user.member_id}，已迁移命盘 ${payload.migrated?.chart_ids.length ?? 0} 个。`);
      event.currentTarget.reset();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "账号绑定失败，请稍后重试。");
    } finally {
      setIsBinding(false);
    }
  }

  return (
    <section className="account-auth-layout" aria-label="账号登录与绑定">
      <form className="public-form-card" onSubmit={sendSms}>
        <div className="panel-title-row">
          <Smartphone aria-hidden="true" size={18} />
          <h2>手机号验证码登录</h2>
        </div>
        <div className="public-form-grid single-column">
          <label>
            登录手机号
            <input
              autoComplete="tel"
              inputMode="tel"
              name="phone"
              onChange={(event) => setPhone(event.target.value)}
              pattern="1[3-9][0-9]{9}"
              placeholder="请输入中国大陆手机号"
              required
              type="tel"
              value={phone}
            />
          </label>
        </div>
        <button className="public-submit-button" disabled={isSending || !phone.trim()} type="submit">
          <KeyRound aria-hidden="true" size={18} />
          {isSending ? "发送中" : "获取验证码"}
        </button>
        {smsStatus ? <p className="success-message">{smsStatus}</p> : null}
      </form>

      <form className="public-form-card" onSubmit={loginWithSms}>
        <div className="panel-title-row">
          <LogIn aria-hidden="true" size={18} />
          <h2>完成登录</h2>
        </div>
        <div className="public-form-grid">
          <label>
            验证码
            <input autoComplete="one-time-code" inputMode="numeric" maxLength={6} name="code" pattern="[0-9]{6}" placeholder="6 位数字" required />
          </label>
          <label>
            登录昵称
            <input autoComplete="name" name="display_name" placeholder="用于会员中心展示" />
          </label>
        </div>
        <div className="public-privacy-callout">
          <ShieldCheck aria-hidden="true" size={18} />
          <p>登录成功后，当前匿名访客下创建的命盘会迁移到会员身份；手机号只保存哈希值，验证码只保存哈希值和过期时间。</p>
        </div>
        <button className="public-submit-button" disabled={isLoggingIn || !phone.trim()} type="submit">
          <LogIn aria-hidden="true" size={18} />
          {isLoggingIn ? "登录中" : "登录并迁移匿名资料"}
        </button>
      </form>

      <form className="public-form-card secondary-account-card" onSubmit={bindAnonymous}>
        <div className="panel-title-row">
          <ShieldCheck aria-hidden="true" size={18} />
          <h2>已有客服绑定码时绑定</h2>
        </div>
        <div className="public-form-grid">
          <label>
            绑定昵称
            <input autoComplete="name" name="display_name" placeholder="用于会员中心展示" />
          </label>
          <label>
            邮箱
            <input autoComplete="email" name="email" placeholder="you@example.com" type="email" />
          </label>
          <label>
            绑定手机号
            <input autoComplete="tel" inputMode="tel" name="phone" pattern="1[3-9][0-9]{9}" placeholder="可选" type="tel" />
          </label>
        </div>
        <p className="muted">此入口用于客服核验或旧流程绑定；大众用户优先使用手机号验证码登录。</p>
        <button className="public-submit-button" disabled={isBinding} type="submit">
          <ShieldCheck aria-hidden="true" size={18} />
          {isBinding ? "绑定中" : "绑定当前匿名资料"}
        </button>
      </form>

      {status ? <p className="success-message account-auth-result">{status}</p> : null}
      {error ? <p className="error-message account-auth-result">{error}</p> : null}
    </section>
  );
}

function optionalText(value: FormDataEntryValue | null): string | undefined {
  const text = String(value ?? "").trim();
  return text || undefined;
}

function requiredText(value: FormDataEntryValue | null): string {
  return String(value ?? "").trim();
}
