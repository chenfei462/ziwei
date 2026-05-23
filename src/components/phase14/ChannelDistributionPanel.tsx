"use client";

import { BarChart3, Link2, QrCode, Share2, UserRoundPlus } from "lucide-react";
import { useState } from "react";
import type {
  AnonymousLinkResponse,
  ChannelDashboardResponse,
  ChannelEntryResponse,
  ChannelGrowthEventResponse,
  ChannelShareCreateResponse
} from "../../types.js";

type ChannelDistributionPanelProps = {
  memberId: string;
};

export function ChannelDistributionPanel({ memberId }: ChannelDistributionPanelProps) {
  const [entry, setEntry] = useState<ChannelEntryResponse | undefined>();
  const [link, setLink] = useState<AnonymousLinkResponse | undefined>();
  const [share, setShare] = useState<ChannelShareCreateResponse | undefined>();
  const [event, setEvent] = useState<ChannelGrowthEventResponse | undefined>();
  const [dashboard, setDashboard] = useState<ChannelDashboardResponse | undefined>();
  const [error, setError] = useState<string | undefined>();
  const [isLoading, setIsLoading] = useState(false);

  async function createEntry() {
    await runAction(async () => {
      const response = await fetch("/api/channel/entry", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          channel: "wechat_group",
          campaign: "phase14_channel_demo",
          referrer: "phase14_wechat_group",
          visitor_id: "visitor_phase14_demo"
        })
      });
      setEntry(await readJson<ChannelEntryResponse>(response, "Channel entry failed."));
    });
  }

  async function linkAnonymousVisitor() {
    const visitorId = entry?.entry.visitor_id ?? "visitor_phase14_demo";
    await runAction(async () => {
      const response = await fetch("/api/member/link-anonymous", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          visitor_id: visitorId,
          member_id: memberId,
          openid_placeholder: "openid_reserved_phase14"
        })
      });
      setLink(await readJson<AnonymousLinkResponse>(response, "Anonymous link failed."));
    });
  }

  async function createShare() {
    await runAction(async () => {
      const response = await fetch("/api/share/create", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          member_id: memberId,
          source_type: "daily_theme",
          source_id: "daily_20270816_life",
          title: "Today Stargarden channel card",
          summary: "A mini program ready card for low-risk daily observation.",
          keywords: ["Zi Wei", "Hua Lu"],
          safety_flags: ["daily_observation_only"],
          share_format: "mini_program_card",
          channel: "wechat_group",
          campaign: "phase14_channel_demo",
          visitor_id: entry?.entry.visitor_id ?? "visitor_phase14_demo"
        })
      });
      setShare(await readJson<ChannelShareCreateResponse>(response, "Channel share failed."));
    });
  }

  async function recordChannelEvent() {
    const shareId = share?.snapshot.share_id;
    await runAction(async () => {
      const response = await fetch("/api/growth/channel-event", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          share_id: shareId,
          event_type: "share_opened",
          channel: "wechat_group",
          campaign: "phase14_channel_demo",
          visitor_id: entry?.entry.visitor_id ?? "visitor_phase14_demo",
          member_id: memberId,
          metadata: {
            surface: "mini_program_card"
          }
        })
      });
      setEvent(await readJson<ChannelGrowthEventResponse>(response, "Channel event failed."));
    });
  }

  async function loadDashboard() {
    await runAction(async () => {
      const response = await fetch("/api/growth/channel-dashboard");
      setDashboard(await readJson<ChannelDashboardResponse>(response, "Channel dashboard failed."));
    });
  }

  async function runAction(action: () => Promise<void>) {
    setIsLoading(true);
    setError(undefined);
    try {
      await action();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Phase 14 action failed.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <section className="phase14-panel">
      <div className="panel-title-row">
        <QrCode aria-hidden="true" size={18} />
        <h2>Channel Distribution Console</h2>
      </div>

      <div className="phase14-channel-card">
        <strong>Mini program H5 container</strong>
        <span>container_route: webview_h5_first</span>
        <span>supported_sources: wechat_group, mini_program, qr_event, short_video, creator_homepage, organic</span>
        <span>content_boundary: daily_observation_only</span>
      </div>

      <div className="phase14-action-row">
        <button disabled={isLoading} onClick={createEntry} type="button">
          <QrCode aria-hidden="true" size={15} />
          Create channel entry
        </button>
        <button disabled={isLoading} onClick={linkAnonymousVisitor} type="button">
          <UserRoundPlus aria-hidden="true" size={15} />
          Link anonymous visitor
        </button>
        <button disabled={isLoading} onClick={createShare} type="button">
          <Share2 aria-hidden="true" size={15} />
          Create channel share
        </button>
        <button disabled={isLoading || !share} onClick={recordChannelEvent} type="button">
          <Link2 aria-hidden="true" size={15} />
          Record channel event
        </button>
        <button disabled={isLoading} onClick={loadDashboard} type="button">
          <BarChart3 aria-hidden="true" size={15} />
          Load channel dashboard
        </button>
      </div>

      <div className="phase14-metric-row">
        {entry ? <span>channel_entry_ready</span> : null}
        {link ? <span>anonymous_linked</span> : null}
        {share ? <span>{share.channel_share.share_format}</span> : null}
        {event ? <span>channel_event_recorded</span> : null}
        {dashboard ? <span>total_channel_events: {dashboard.dashboard.total_channel_events}</span> : null}
      </div>

      {entry ? (
        <article className="phase14-result-card">
          <strong>{entry.entry.channel}</strong>
          <span>visitor_id: {entry.entry.visitor_id}</span>
          <span>{entry.landing_url}</span>
        </article>
      ) : null}

      {share ? (
        <article className="phase14-result-card">
          <strong>{share.channel_share.title}</strong>
          <p>{share.channel_share.summary}</p>
          <span>{share.channel_share.channel}</span>
          <a href={share.share_url}>Open channel share</a>
          <div className="phase14-chip-row">
            {share.channel_share.safety_flags.map((flag) => (
              <span key={flag}>{flag}</span>
            ))}
          </div>
        </article>
      ) : null}

      {dashboard ? (
        <article className="phase14-result-card">
          <strong>Channel attribution</strong>
          <span>wechat_group: {dashboard.dashboard.by_channel.wechat_group}</span>
          <span>share_opened: {dashboard.dashboard.by_event.share_opened}</span>
          <span>mini_program_card: {dashboard.dashboard.by_share_format.mini_program_card}</span>
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
