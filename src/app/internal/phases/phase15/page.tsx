import { MiniProgramLaunchPanel } from "../../../../components/phase15/MiniProgramLaunchPanel.js";

export const dynamic = "force-dynamic";

const memberId = "member_phase15_demo";

export default function Phase15Page() {
  return (
    <main className="phase15-page">
      <section className="workspace-header">
        <div>
          <p className="eyebrow">Phase 15 WeChat Mini Program Review</p>
          <h1>Phase 15 Mini Program Review</h1>
        </div>
        <div className="status-strip" aria-label="Phase 15 status">
          <span>native_shell_v0.1</span>
          <span>openid_binding_v0.1</span>
          <span>review_gate_v0.1</span>
        </div>
      </section>
      <section className="phase15-layout">
        <MiniProgramLaunchPanel memberId={memberId} />
        <aside className="phase15-panel">
          <div className="panel-title-row">
            <h2>Review Guardrails</h2>
          </div>
          <ul className="phase10-scope-list">
            <li>The formal mini program shell keeps core chart, daily, atlas, challenge, and report-intent surfaces in the existing WebView.</li>
            <li>Wechat login stores hashed openid references only; raw code and raw openid are not retained.</li>
            <li>Subscription reminders are limited to daily Stargarden revisit and challenge progress prompts.</li>
            <li>If review wording is restricted, the release gate keeps H5 fallback active and uses traditional culture self-observation copy.</li>
          </ul>
        </aside>
      </section>
    </main>
  );
}

