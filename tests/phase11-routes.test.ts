import { describe, expect, test } from "vitest";
import { POST as compareRulesPost } from "../src/app/api/chart/compare-rules/route.js";
import { GET as knowledgeNodeGet } from "../src/app/api/knowledge/node/[id]/route.js";
import { GET as knowledgeSearchGet } from "../src/app/api/knowledge/search/route.js";
import { GET as ruleProfileGet } from "../src/app/api/rule-profiles/[id]/route.js";
import { GET as ruleProfilesGet } from "../src/app/api/rule-profiles/route.js";

const birthProfile = {
  display_name: "Phase 11 route profile",
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
};

describe("phase 11 route handlers", () => {
  test("serves rule profiles, compares profiles, and searches the knowledge graph", async () => {
    const profilesResponse = await ruleProfilesGet();
    const profiles = await profilesResponse.json();
    const profileResponse = await ruleProfileGet(new Request("http://local/api/rule-profiles/default_ziwei_v0_1"), {
      params: Promise.resolve({ id: "default_ziwei_v0_1" })
    });
    const profile = await profileResponse.json();
    const compareResponse = await compareRulesPost(
      new Request("http://local/api/chart/compare-rules", {
        method: "POST",
        body: JSON.stringify({
          birth_profile: birthProfile,
          base_rule_profile_id: "default_ziwei_v0_1",
          candidate_rule_profile_id: "experimental_sanhe_v0_1"
        })
      })
    );
    const comparison = await compareResponse.json();
    const searchResponse = await knowledgeSearchGet(new Request("http://local/api/knowledge/search?q=Zi%20Wei&type=star"));
    const search = await searchResponse.json();
    const nodeResponse = await knowledgeNodeGet(new Request("http://local/api/knowledge/node/star_zi_wei"), {
      params: Promise.resolve({ id: "star_zi_wei" })
    });
    const node = await nodeResponse.json();

    expect(profilesResponse.status).toBe(200);
    expect(profiles.profiles.length).toBeGreaterThanOrEqual(2);
    expect(profileResponse.status).toBe(200);
    expect(profile.profile_id).toBe("default_ziwei_v0_1");
    expect(compareResponse.status).toBe(200);
    expect(comparison.diffs.length).toBeGreaterThanOrEqual(2);
    expect(searchResponse.status).toBe(200);
    expect(search.results[0].node.node_id).toBe("star_zi_wei");
    expect(nodeResponse.status).toBe(200);
    expect(node.related_nodes.length).toBeGreaterThan(0);
    expect(JSON.stringify({ profiles, profile, comparison, search, node })).not.toContain("2000-08-16");
    expect(JSON.stringify({ profiles, profile, comparison, search, node })).not.toContain("03:30");
    expect(JSON.stringify({ profiles, profile, comparison, search, node })).not.toContain("Shanghai");
  });

  test("returns existing error envelopes for invalid rule profile and node IDs", async () => {
    const profileResponse = await ruleProfileGet(new Request("http://local/api/rule-profiles/missing"), {
      params: Promise.resolve({ id: "missing" })
    });
    const profile = await profileResponse.json();
    const nodeResponse = await knowledgeNodeGet(new Request("http://local/api/knowledge/node/missing"), {
      params: Promise.resolve({ id: "missing" })
    });
    const node = await nodeResponse.json();

    expect(profileResponse.status).toBe(404);
    expect(profile.error.code).toBe("RULE_PROFILE_NOT_FOUND");
    expect(nodeResponse.status).toBe(404);
    expect(node.error.code).toBe("KNOWLEDGE_NODE_NOT_FOUND");
  });
});
