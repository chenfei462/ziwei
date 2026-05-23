import { RuleKnowledgePanel } from "../../components/phase11/RuleKnowledgePanel.js";
import { listRuleProfiles } from "../../phase11/ruleKnowledge.js";

export const dynamic = "force-dynamic";

export default function Phase11Page() {
  const profiles = listRuleProfiles();

  return (
    <main className="phase11-page">
      <section className="workspace-header">
        <div>
          <p className="eyebrow">Phase 11 Rule Profiles</p>
          <h1>Phase 11 Rule Profiles And Knowledge Graph</h1>
        </div>
        <div className="status-strip" aria-label="Phase 11 status">
          <span>rule_profiles_v0.1</span>
          <span>knowledge_graph_v0.1</span>
          <span>default_profile_locked</span>
        </div>
      </section>
      <section className="phase11-layout">
        <RuleKnowledgePanel initialProfiles={profiles} />
        <aside className="phase11-panel">
          <div className="panel-title-row">
            <h2>Phase 11 Guardrails</h2>
          </div>
          <ul className="phase10-scope-list">
            <li>Experimental profiles are comparison-only until consultant golden samples are approved.</li>
            <li>Rule versions are attached to chart, report, synastry, and timeline outputs for traceability.</li>
            <li>Knowledge nodes store source metadata and short excerpts only.</li>
            <li>Knowledge graph output remains cultural interpretation support, not open-ended prediction.</li>
          </ul>
        </aside>
      </section>
    </main>
  );
}
