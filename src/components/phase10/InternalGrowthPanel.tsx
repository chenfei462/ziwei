import { BarChart3, CircleDollarSign, ShieldAlert } from "lucide-react";
import type { InternalGrowthInsights } from "../../types.js";

type InternalGrowthPanelProps = {
  insights: InternalGrowthInsights;
};

export function InternalGrowthPanel({ insights }: InternalGrowthPanelProps) {
  const { launch_growth, channel_dashboard, proxy, channel_mix, anomalies, measurement_note } = insights;

  return (
    <section className="phase10-panel internal-growth-panel">
      <div className="panel-title-row">
        <BarChart3 aria-hidden="true" size={18} />
        <h2>Internal Growth Lens</h2>
      </div>
      <p className="muted">
        Exact ROI is unavailable here. This lens uses conservative proxy metrics from launch events, channel events, and shared member overlap only.
      </p>

      <div className="phase10-result" aria-label="growth proxy summary">
        <span>{proxy.mode}</span>
        <span>{proxy.exact_roi_available ? "exact roi" : "proxy only"}</span>
        <span>events {proxy.channel_events}</span>
        <span>visitors {proxy.unique_visitors}</span>
        <span>launch {proxy.launch_events}</span>
        <span>shared {proxy.shared_members}</span>
      </div>

      <div className="commercial-ops-section" aria-label="growth funnel">
        <div className="panel-title-row">
          <BarChart3 aria-hidden="true" size={18} />
          <h3>Growth Funnel</h3>
        </div>
        <div className="phase10-metric-row">
          <span>chart_to_purchase {launch_growth.chart_to_purchase}</span>
          <span>preview_to_payment {launch_growth.preview_to_payment}</span>
          <span>payment_to_revisit {launch_growth.payment_to_revisit}</span>
          <span>entitlement_usage {launch_growth.entitlement_usage}</span>
          <span>share_to_purchase {launch_growth.share_to_purchase}</span>
          <span>repeat_purchase_intent {launch_growth.repeat_purchase_intent}</span>
        </div>
        <div className="phase10-metric-row">
          <span>total channel events {channel_dashboard.total_channel_events}</span>
          <span>unique visitors {channel_dashboard.unique_visitors}</span>
          <span>report intent {channel_dashboard.report_intent_events}</span>
          <span>challenge join {channel_dashboard.challenge_join_events}</span>
          <span>disabled channels {channel_dashboard.disabled_channels.length}</span>
        </div>
      </div>

      <div className="phase10-metric-row">
        <span>conversion {formatPercent(proxy.proxy_conversion_rate)}</span>
        <span>launch value {formatCurrency(proxy.launch_value_cents)}</span>
        <span>per shared member {formatCurrency(proxy.proxy_value_per_shared_member_cents)}</span>
        <span>per channel event {formatCurrency(proxy.proxy_value_per_channel_event_cents)}</span>
        <span>shared launch events {proxy.shared_launch_events}</span>
      </div>

      <div className="commercial-ops-section" aria-label="channel mix">
        <div className="panel-title-row">
          <CircleDollarSign aria-hidden="true" size={18} />
          <h3>Channel Mix</h3>
        </div>
        <div className="commercial-ops-provider-grid">
          {channel_mix.map((item) => (
            <article className="commercial-ops-provider-card" key={item.channel}>
              <strong>{item.channel}</strong>
              <div className="phase10-metric-row">
                <span>events {item.event_count}</span>
                <span>visitors {item.unique_visitors}</span>
              </div>
              <div className="phase10-metric-row">
                <span>event share {item.event_share_percent}%</span>
                <span>visitor share {item.visitor_share_percent}%</span>
                <span>{item.status}</span>
              </div>
            </article>
          ))}
        </div>
      </div>

      <div className="commercial-ops-section" aria-label="channel health">
        <div className="panel-title-row">
          <ShieldAlert aria-hidden="true" size={18} />
          <h3>Channel Health</h3>
        </div>
        <div className="commercial-ops-provider-grid">
          {channel_dashboard.channel_health.map((item) => (
            <article className="commercial-ops-provider-card" key={item.channel}>
              <strong>{item.channel}</strong>
              <div className="phase10-metric-row">
                <span>{item.status}</span>
                <span>duplicates {item.duplicate_event_count}</span>
                <span>intent {item.report_intent_events}</span>
              </div>
              <small>{item.recommendation}</small>
            </article>
          ))}
        </div>
      </div>

      <div className="commercial-ops-subsection" aria-label="growth anomalies">
        <div className="panel-title-row">
          <ShieldAlert aria-hidden="true" size={18} />
          <h3>Anomaly Flags</h3>
        </div>
        {anomalies.length > 0 ? (
          <ul className="commercial-ops-list">
            {anomalies.map((anomaly) => (
              <li key={anomaly.code}>
                <strong>
                  {anomaly.severity} · {anomaly.title}
                </strong>
                <span>{anomaly.detail}</span>
                <small>{anomaly.recommendation}</small>
                <small>{anomaly.affected_channels.length > 0 ? `affected: ${anomaly.affected_channels.join(", ")}` : "affected: none"}</small>
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted">No proxy anomalies detected.</p>
        )}
      </div>

      <p className="muted">{measurement_note}</p>
    </section>
  );
}

function formatCurrency(valueCents: number): string {
  return `${(valueCents / 100).toFixed(2)} CNY`;
}

function formatPercent(value: number): string {
  return `${Math.round(value * 100)}%`;
}
