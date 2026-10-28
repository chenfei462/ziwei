import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, test } from "vitest";
import { POST as opsCompareRulesPost } from "../src/app/api/ops/chart/compare-rules/route.js";
import { GET as opsKnowledgeNodeGet } from "../src/app/api/ops/knowledge/node/[id]/route.js";
import { GET as opsKnowledgeSearchGet } from "../src/app/api/ops/knowledge/search/route.js";
import { GET as opsRuleProfileGet } from "../src/app/api/ops/rule-profiles/[id]/route.js";
import { GET as opsRuleProfilesGet } from "../src/app/api/ops/rule-profiles/route.js";
import { handleApiRequest } from "../src/api.js";

const opsHeaders = {
  "x-admin-token": "phase10_admin_token",
  "x-admin-role": "content_reviewer",
  "x-admin-actor": "ops_rule_knowledge_route_test"
};

const birthProfile = {
  display_name: "Ops rule comparison",
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

describe("internal rule knowledge route handlers", () => {
  test("keeps rule and knowledge tooling out of the public API tree", () => {
    for (const legacyPath of [
      "src/app/api/rule-profiles",
      "src/app/api/knowledge",
      "src/app/api/chart/compare-rules"
    ]) {
      expect(existsSync(resolve(legacyPath)), legacyPath).toBe(false);
    }
  });

  test("serves rule profiles, comparisons, and knowledge graph behind ops authorization", async () => {
    const profilesResponse = await opsRuleProfilesGet(
      new Request("http://local/api/ops/rule-profiles", {
        headers: opsHeaders
      })
    );
    const profiles = await profilesResponse.json();
    const profileResponse = await opsRuleProfileGet(
      new Request("http://local/api/ops/rule-profiles/default_ziwei_v0_1", {
        headers: opsHeaders
      }),
      { params: Promise.resolve({ id: "default_ziwei_v0_1" }) }
    );
    const profile = await profileResponse.json();
    const compareResponse = await opsCompareRulesPost(
      new Request("http://local/api/ops/chart/compare-rules", {
        method: "POST",
        headers: opsHeaders,
        body: JSON.stringify({
          birth_profile: birthProfile,
          base_rule_profile_id: "default_ziwei_v0_1",
          candidate_rule_profile_id: "experimental_sanhe_v0_1"
        })
      })
    );
    const comparison = await compareResponse.json();
    const searchResponse = await opsKnowledgeSearchGet(
      new Request("http://local/api/ops/knowledge/search?q=Zi%20Wei&type=star", {
        headers: opsHeaders
      })
    );
    const search = await searchResponse.json();
    const nodeResponse = await opsKnowledgeNodeGet(
      new Request("http://local/api/ops/knowledge/node/star_zi_wei", {
        headers: opsHeaders
      }),
      { params: Promise.resolve({ id: "star_zi_wei" }) }
    );
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
    expect(JSON.stringify({ profiles, profile, comparison, search, node })).not.toMatch(/2000-08-16|03:30|Shanghai/);
  });

  test("rejects rule and knowledge tooling without ops credentials", async () => {
    const profilesResponse = await opsRuleProfilesGet(new Request("http://local/api/ops/rule-profiles"));
    const profiles = await profilesResponse.json();
    const searchResponse = await opsKnowledgeSearchGet(new Request("http://local/api/ops/knowledge/search?q=Zi%20Wei"));
    const search = await searchResponse.json();
    const compareResponse = await opsCompareRulesPost(
      new Request("http://local/api/ops/chart/compare-rules", {
        method: "POST",
        body: JSON.stringify({
          birth_profile: birthProfile,
          base_rule_profile_id: "default_ziwei_v0_1",
          candidate_rule_profile_id: "experimental_sanhe_v0_1"
        })
      })
    );
    const comparison = await compareResponse.json();

    expect(profilesResponse.status).toBe(401);
    expect(profiles.error.code).toBe("OPS_AUTH_REQUIRED");
    expect(searchResponse.status).toBe(401);
    expect(search.error.code).toBe("OPS_AUTH_REQUIRED");
    expect(compareResponse.status).toBe(401);
    expect(comparison.error.code).toBe("OPS_AUTH_REQUIRED");
  });

  test("does not serve legacy public rule and knowledge dispatcher paths", () => {
    for (const path of [
      "/api/rule-profiles",
      "/api/rule-profiles/default_ziwei_v0_1",
      "/api/knowledge/search?q=Zi%20Wei",
      "/api/knowledge/node/star_zi_wei"
    ]) {
      const response = handleApiRequest("GET", path);
      expect(response.status, path).toBe(404);
      expect(response.body.error).toMatchObject({ code: "ROUTE_NOT_FOUND" });
    }

    const compare = handleApiRequest("POST", "/api/chart/compare-rules", {
      birth_profile: birthProfile,
      base_rule_profile_id: "default_ziwei_v0_1",
      candidate_rule_profile_id: "experimental_sanhe_v0_1"
    });
    expect(compare.status).toBe(404);
    expect(compare.body.error).toMatchObject({ code: "ROUTE_NOT_FOUND" });
  });
});
