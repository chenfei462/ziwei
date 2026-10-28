import { ChannelDistributionPanel } from "../../../../components/phase14/ChannelDistributionPanel.js";

export const dynamic = "force-dynamic";

const memberId = "member_phase14_demo";

export default function Phase14Page() {
  return (
    <main className="phase14-page">
      <section className="workspace-header">
        <div>
          <p className="eyebrow">Phase 14 Mini Program And Channel Distribution</p>
          <h1>Phase 14 Channel Distribution</h1>
        </div>
        <div className="status-strip" aria-label="Phase 14 status">
          <span>mini_program_h5_v0.1</span>
          <span>channel_attribution_v0.1</span>
          <span>privacy_share_v0.1</span>
        </div>
      </section>
      <section className="phase14-layout">
        <ChannelDistributionPanel memberId={memberId} />
        <aside className="phase14-panel">
          <div className="panel-title-row">
            <h2>Channel Guardrails</h2>
          </div>
          <ul className="phase10-scope-list">
            <li>Wechat mini program delivery uses an H5 WebView container first, reusing existing Next.js APIs and share snapshots.</li>
            <li>Channel attribution records behavior events, campaign labels, visitor ids, and share ids without full birth data or camera frames.</li>
            <li>Share assets cover mini program cards, H5 posters, QR landing pages, and creator homepage blocks.</li>
            <li>Platform review fallback labels the experience as traditional culture star cards and self-observation tooling.</li>
          </ul>
        </aside>
      </section>
    </main>
  );
}

