"use client";

import { Bell, CheckCircle2, Rocket, Share2, ShieldCheck, UserRoundCheck } from "lucide-react";
import { useState } from "react";
import type {
  MiniProgramLinkMemberResponse,
  MiniProgramLoginResponse,
  MiniProgramReleaseGateResponse,
  MiniProgramReminderEventResponse,
  MiniProgramShareCreateResponse,
  MiniProgramSubscribeResponse
} from "../../types.js";

type MiniProgramLaunchPanelProps = {
  memberId: string;
};

export function MiniProgramLaunchPanel({ memberId }: MiniProgramLaunchPanelProps) {
  const [login, setLogin] = useState<MiniProgramLoginResponse | undefined>();
  const [link, setLink] = useState<MiniProgramLinkMemberResponse | undefined>();
  const [share, setShare] = useState<MiniProgramShareCreateResponse | undefined>();
  const [subscribe, setSubscribe] = useState<MiniProgramSubscribeResponse | undefined>();
  const [reminder, setReminder] = useState<MiniProgramReminderEventResponse | undefined>();
  const [releaseGate, setReleaseGate] = useState<MiniProgramReleaseGateResponse | undefined>();
  const [error, setError] = useState<string | undefined>();
  const [isLoading, setIsLoading] = useState(false);

  async function loginMiniProgram() {
    await runAction(async () => {
      const response = await fetch("/api/mini-program/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          code: "wx_code_phase15_demo",
          channel: "mini_program",
          campaign: "phase15_review_demo"
        })
      });
      const payload = await readJson<MiniProgramLoginResponse>(response, "Mini program login failed.");
      setLogin(payload);
      setReleaseGate({ release_gate: payload.release_gate, privacy: payload.privacy });
    });
  }

  async function linkWeChatMember() {
    const openidHash = login?.binding.openid_hash;
    await runAction(async () => {
      const response = await fetch("/api/mini-program/link-member", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          openid_hash: openidHash
        })
      });
      setLink(await readJson<MiniProgramLinkMemberResponse>(response, "Mini program member link failed."));
    });
  }

  async function createMiniShare() {
    await runAction(async () => {
      const response = await fetch("/api/share/create", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          source_type: "daily_theme",
          source_id: "daily_20270816_life",
          title: "Today Stargarden mini program card",
          summary: "A review-safe WeChat mini program card for self-observation.",
          keywords: ["Zi Wei", "Hua Lu"],
          safety_flags: ["daily_observation_only"],
          mini_program_share_format: "wechat_mini_card",
          channel: "mini_program",
          campaign: "phase15_review_demo"
        })
      });
      setShare(await readJson<MiniProgramShareCreateResponse>(response, "Mini program share failed."));
    });
  }

  async function authorizeReminder() {
    await runAction(async () => {
      const response = await fetch("/api/mini-program/subscribe", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          template_type: "daily_stargarden_reminder",
          template_id: "tmpl_daily_phase15",
          consent_granted: true,
          channel: "mini_program"
        })
      });
      setSubscribe(await readJson<MiniProgramSubscribeResponse>(response, "Mini program subscribe failed."));
    });
  }

  async function recordReminderEvent() {
    await runAction(async () => {
      const response = await fetch("/api/mini-program/reminder-event", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          template_type: "daily_stargarden_reminder",
          target_date: "2027-08-16",
          action: "daily_reminder_queued",
          metadata: {
            surface: "mini_program"
          }
        })
      });
      setReminder(await readJson<MiniProgramReminderEventResponse>(response, "Mini program reminder failed."));
    });
  }

  async function loadReleaseGate() {
    await runAction(async () => {
      const response = await fetch("/api/mini-program/release-gate");
      setReleaseGate(await readJson<MiniProgramReleaseGateResponse>(response, "Release gate load failed."));
    });
  }

  async function runAction(action: () => Promise<void>) {
    setIsLoading(true);
    setError(undefined);
    try {
      await action();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Phase 15 action failed.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <section className="phase15-panel">
      <div className="panel-title-row">
        <Rocket aria-hidden="true" size={18} />
        <h2>Mini Program Launch Console</h2>
      </div>

      <div className="phase15-shell-card">
        <strong>Native shell plus WebView</strong>
        <span>shell_route: mini-program/pages/index</span>
        <span>webview_fallback: /chart/new</span>
        <span>review_copy: traditional culture self-observation</span>
      </div>

      <div className="phase15-action-row">
        <button disabled={isLoading} onClick={loginMiniProgram} type="button">
          <Rocket aria-hidden="true" size={15} />
          Login mini program
        </button>
        <button disabled={isLoading || !login} onClick={linkWeChatMember} type="button">
          <UserRoundCheck aria-hidden="true" size={15} />
          Link WeChat member
        </button>
        <button disabled={isLoading} onClick={createMiniShare} type="button">
          <Share2 aria-hidden="true" size={15} />
          Create mini share
        </button>
        <button disabled={isLoading} onClick={authorizeReminder} type="button">
          <Bell aria-hidden="true" size={15} />
          Authorize reminder
        </button>
        <button disabled={isLoading || !subscribe} onClick={recordReminderEvent} type="button">
          <CheckCircle2 aria-hidden="true" size={15} />
          Record reminder event
        </button>
        <button disabled={isLoading} onClick={loadReleaseGate} type="button">
          <ShieldCheck aria-hidden="true" size={15} />
          Load release gate
        </button>
      </div>

      <div className="phase15-metric-row">
        {login ? <span>mini_program_session_ready</span> : null}
        {link ? <span>openid_bound</span> : null}
        {share ? <span>{share.mini_program_share.share_format}</span> : null}
        {subscribe ? <span>subscribe_authorized</span> : null}
        {reminder ? <span>reminder_event_recorded</span> : null}
        {releaseGate ? <span>review_status: {releaseGate.release_gate.review_status}</span> : null}
        {releaseGate ? <span>fallback_to_h5: {String(releaseGate.release_gate.fallback_to_h5)}</span> : null}
      </div>

      {login ? (
        <article className="phase15-result-card">
          <strong>{login.session.channel}</strong>
          <span>member_id: {login.session.member_id}</span>
          <span>openid_binding_status: {login.session.openid_binding_status}</span>
        </article>
      ) : null}

      {share ? (
        <article className="phase15-result-card">
          <strong>{share.mini_program_share.title}</strong>
          <p>{share.mini_program_share.summary}</p>
          <span>{share.mini_program_share.path}</span>
          <div className="phase15-chip-row">
            {share.mini_program_share.safety_flags.map((flag) => (
              <span key={flag}>{flag}</span>
            ))}
          </div>
        </article>
      ) : null}

      {releaseGate ? (
        <article className="phase15-result-card">
          <strong>Release gate</strong>
          <span>version: {releaseGate.release_gate.version}</span>
          <span>rollout_percent: {releaseGate.release_gate.rollout_percent}</span>
          <span>allowed_channels: {releaseGate.release_gate.allowed_channels.join(", ")}</span>
        </article>
      ) : null}

      {error ? <p className="error-message">{error}</p> : null}
    </section>
  );
}

async function readJson<T extends object>(response: Response, fallback: string): Promise<T> {
  const payload = (await response.json()) as T | { error?: { message?: string } };
  if (!response.ok) {
    throw new Error("error" in payload ? payload.error?.message ?? fallback : fallback);
  }
  return payload as T;
}
