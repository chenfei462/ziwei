"use client";

import { GitCompareArrows, Network, Search } from "lucide-react";
import { useState } from "react";
import type {
  KnowledgeNodeDetail,
  KnowledgeSearchResponse,
  KnowledgeSearchResult,
  RuleCompareResponse,
  RuleProfileListResponse
} from "../../types.js";

type RuleKnowledgePanelProps = {
  initialProfiles: RuleProfileListResponse;
};

const comparisonBirthProfile = {
  display_name: "Phase 11 comparison",
  calendar_type: "gregorian",
  birth_date: "2000-08-16",
  birth_time: "03:30",
  timezone: "Asia/Shanghai",
  location: {
    name: "Shanghai",
    longitude: 121.4737,
    latitude: 31.2304
  },
  is_leap_month: false,
  true_solar_time_enabled: false,
  gender_rule: "traditional_male"
} as const;

export function RuleKnowledgePanel({ initialProfiles }: RuleKnowledgePanelProps) {
  const [baseProfileId, setBaseProfileId] = useState(initialProfiles.default_profile_id);
  const [candidateProfileId, setCandidateProfileId] = useState(
    initialProfiles.profiles.find((profile) => !profile.is_default)?.profile_id ?? initialProfiles.default_profile_id
  );
  const [comparison, setComparison] = useState<RuleCompareResponse | undefined>();
  const [query, setQuery] = useState("Zi Wei");
  const [searchResults, setSearchResults] = useState<KnowledgeSearchResult[]>([]);
  const [nodeDetail, setNodeDetail] = useState<KnowledgeNodeDetail | undefined>();
  const [error, setError] = useState<string | undefined>();
  const [isLoading, setIsLoading] = useState(false);

  async function compareProfiles() {
    setIsLoading(true);
    setError(undefined);
    try {
      const response = await fetch("/api/chart/compare-rules", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          birth_profile: comparisonBirthProfile,
          base_rule_profile_id: baseProfileId,
          candidate_rule_profile_id: candidateProfileId
        })
      });
      const payload = (await response.json()) as RuleCompareResponse | { error?: { message?: string } };
      if (!response.ok) {
        throw new Error("error" in payload ? payload.error?.message : "Rule comparison failed.");
      }
      setComparison(payload as RuleCompareResponse);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Rule comparison failed.");
    } finally {
      setIsLoading(false);
    }
  }

  async function searchKnowledge() {
    setIsLoading(true);
    setError(undefined);
    try {
      const response = await fetch(`/api/knowledge/search?q=${encodeURIComponent(query)}&limit=8`);
      const payload = (await response.json()) as KnowledgeSearchResponse | { error?: { message?: string } };
      if (!response.ok) {
        throw new Error("error" in payload ? payload.error?.message : "Knowledge search failed.");
      }
      const searchPayload = payload as KnowledgeSearchResponse;
      setQuery(searchPayload.query);
      setSearchResults(searchPayload.results);
      setNodeDetail(undefined);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Knowledge search failed.");
    } finally {
      setIsLoading(false);
    }
  }

  async function openNode(nodeId: string) {
    setIsLoading(true);
    setError(undefined);
    try {
      const response = await fetch(`/api/knowledge/node/${nodeId}`);
      const payload = (await response.json()) as KnowledgeNodeDetail | { error?: { message?: string } };
      if (!response.ok) {
        throw new Error("error" in payload ? payload.error?.message : "Knowledge node lookup failed.");
      }
      setNodeDetail(payload as KnowledgeNodeDetail);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Knowledge node lookup failed.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <section className="phase11-panel">
      <div className="panel-title-row">
        <Network aria-hidden="true" size={18} />
        <h2>Rule And Knowledge Console</h2>
      </div>

      <div className="phase11-profile-grid">
        {initialProfiles.profiles.map((profile) => (
          <article key={profile.profile_id} className="phase11-profile-card">
            <strong>{profile.label}</strong>
            <span>{profile.profile_id}</span>
            <span>{profile.version.version_id}</span>
            <span>{profile.consultant_review_status}</span>
          </article>
        ))}
      </div>

      <div className="phase11-control-grid">
        <label>
          Base profile
          <select value={baseProfileId} onChange={(event) => setBaseProfileId(event.target.value)}>
            {initialProfiles.profiles.map((profile) => (
              <option key={profile.profile_id} value={profile.profile_id}>
                {profile.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Candidate profile
          <select value={candidateProfileId} onChange={(event) => setCandidateProfileId(event.target.value)}>
            {initialProfiles.profiles.map((profile) => (
              <option key={profile.profile_id} value={profile.profile_id}>
                {profile.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="phase11-action-row">
        <button disabled={isLoading} onClick={compareProfiles} type="button">
          <GitCompareArrows aria-hidden="true" size={15} />
          Compare rule profiles
        </button>
      </div>

      {comparison ? (
        <div className="phase11-result">
          <span>{comparison.base_profile.profile_id}</span>
          <span>{comparison.candidate_profile.profile_id}</span>
          <span>{comparison.base_chart.rule_version}</span>
          <span>{comparison.candidate_chart.rule_version}</span>
          {comparison.diffs.map((diff) => (
            <span key={diff.field}>{diff.field}</span>
          ))}
        </div>
      ) : null}

      <div className="phase11-search-row">
        <label>
          Knowledge query
          <input value={query} onChange={(event) => setQuery(event.target.value)} />
        </label>
        <button disabled={isLoading} onClick={searchKnowledge} type="button">
          <Search aria-hidden="true" size={15} />
          Search knowledge
        </button>
      </div>

      {searchResults.length ? (
        <div className="phase11-knowledge-list">
          {searchResults.map((result) => (
            <article key={result.node.node_id}>
              <strong>{result.node.label}</strong>
              <span>{result.node.node_id}</span>
              <span>{result.node.node_type}</span>
              <button onClick={() => openNode(result.node.node_id)} type="button">
                Open node {result.node.node_id}
              </button>
            </article>
          ))}
        </div>
      ) : null}

      {nodeDetail ? (
        <div className="phase11-node-detail">
          <strong>{nodeDetail.node.label}</strong>
          <p>{nodeDetail.node.summary}</p>
          <div className="phase11-result">
            {nodeDetail.edges.map((edge) => (
              <span key={edge.edge_id}>{edge.relation}</span>
            ))}
          </div>
        </div>
      ) : null}

      {error ? <p className="error-message">{error}</p> : null}
    </section>
  );
}
