import { describe, expect, test } from "vitest";
import { POST as privacyDeletePost } from "../src/app/api/privacy/delete-request/route.js";
import { GET as opsDeletionRequestsGet } from "../src/app/api/ops/deletion-requests/route.js";
import { PATCH as opsDeletionRequestPatch } from "../src/app/api/ops/deletion-request/[id]/route.js";
import { handleApiRequest } from "../src/api.js";
import { clearLaunchOpsForTests } from "../src/store.js";

const adminHeaders = {
  "x-admin-token": "phase10_admin_token",
  "x-admin-role": "ops_admin",
  "x-admin-actor": "privacy_ops"
};

describe("privacy data deletion and account cancellation workflow", () => {
  test("creates a deletion request, lists it for ops, and requires second confirmation before completion", async () => {
    clearLaunchOpsForTests();

    const createResponse = await privacyDeletePost(
      new Request("http://localhost:3000/api/privacy/delete-request", {
        method: "POST",
        headers: {
          origin: "http://localhost:3000",
          "content-type": "application/json",
          "x-member-id": "member_privacy_delete",
          "x-visitor-id": "visitor_privacy_delete"
        },
        body: JSON.stringify({
          scope: "account_closure",
          message: "请删除 2000-08-16 03:30 Shanghai 的全部资料并注销账号。"
        })
      })
    );
    const created = await createResponse.json();

    const listResponse = await opsDeletionRequestsGet(
      new Request("http://local/api/ops/deletion-requests?status=requested", {
        headers: adminHeaders
      })
    );
    const listed = await listResponse.json();

    const unconfirmedResponse = await opsDeletionRequestPatch(
      new Request(`http://local/api/ops/deletion-request/${created.deletion_request.deletion_request_id}`, {
        method: "PATCH",
        headers: adminHeaders,
        body: JSON.stringify({
          status: "completed",
          note: "Processed after identity verification."
        })
      }),
      { params: Promise.resolve({ id: created.deletion_request.deletion_request_id }) }
    );
    const unconfirmed = await unconfirmedResponse.json();

    const completedResponse = await opsDeletionRequestPatch(
      new Request(`http://local/api/ops/deletion-request/${created.deletion_request.deletion_request_id}`, {
        method: "PATCH",
        headers: adminHeaders,
        body: JSON.stringify({
          status: "completed",
          second_confirmed: true,
          note: "Processed after identity verification."
        })
      }),
      { params: Promise.resolve({ id: created.deletion_request.deletion_request_id }) }
    );
    const completed = await completedResponse.json();

    expect(createResponse.status).toBe(201);
    expect(created.deletion_request).toMatchObject({
      member_id: "member_privacy_delete",
      visitor_id: "visitor_privacy_delete",
      scope: "account_closure",
      status: "requested"
    });
    expect(created.ticket.category).toBe("privacy_deletion");
    expect(listResponse.status).toBe(200);
    expect(listed.requests).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          deletion_request_id: created.deletion_request.deletion_request_id,
          status: "requested",
          scope: "account_closure"
        })
      ])
    );
    expect(listed.summary).toMatchObject({
      total: 1,
      requested: 1,
      completed: 0
    });
    expect(unconfirmedResponse.status).toBe(409);
    expect(unconfirmed.error).toMatchObject({ code: "DELETION_SECOND_CONFIRM_REQUIRED" });
    expect(completedResponse.status).toBe(200);
    expect(completed.deletion_request.status).toBe("completed");
    expect(completed.deletion_request.completed_at).toEqual(expect.any(String));
    expect(completed.deletion_request.audit_trail.at(-1)).toMatchObject({
      action: "data_deletion_completed",
      actor_role: "ops_admin",
      actor_id: "ops:ops_admin"
    });
    expect(completed.privacy).toMatchObject({
      sensitive_fields_masked: true,
      destructive_action_requires_second_confirm: true,
      raw_birth_data_removed_from_ops_response: true
    });
    expect(JSON.stringify({ created, listed, completed })).not.toContain("2000-08-16");
    expect(JSON.stringify({ created, listed, completed })).not.toContain("03:30");
    expect(JSON.stringify({ created, listed, completed })).not.toContain("Shanghai");
  });

  test("binds deletion requests to the server-resolved identity and rejects spoofed subjects", async () => {
    clearLaunchOpsForTests();

    const spoofResponse = await privacyDeletePost(
      new Request("http://localhost:3000/api/privacy/delete-request", {
        method: "POST",
        headers: {
          origin: "http://localhost:3000",
          "content-type": "application/json",
          "x-member-id": "member_real_subject",
          "x-visitor-id": "visitor_real_subject"
        },
        body: JSON.stringify({
          member_id: "member_other_subject",
          visitor_id: "visitor_other_subject",
          scope: "all_personal_data",
          message: "request attempts to target another account"
        })
      })
    );
    const spoofed = await spoofResponse.json();

    const createResponse = await privacyDeletePost(
      new Request("http://localhost:3000/api/privacy/delete-request", {
        method: "POST",
        headers: {
          origin: "http://localhost:3000",
          "content-type": "application/json",
          "x-member-id": "member_real_subject",
          "x-visitor-id": "visitor_real_subject"
        },
        body: JSON.stringify({
          scope: "all_personal_data",
          message: "delete my account data"
        })
      })
    );
    const created = await createResponse.json();

    expect(spoofResponse.status).toBe(403);
    expect(spoofed.error).toMatchObject({ code: "DELETION_SUBJECT_FORBIDDEN", field: "member_id" });
    expect(createResponse.status).toBe(201);
    expect(created.deletion_request).toMatchObject({
      member_id: "member_real_subject",
      visitor_id: "visitor_real_subject",
      scope: "all_personal_data",
      status: "requested"
    });
    expect(JSON.stringify(created)).not.toContain("member_other_subject");
    expect(JSON.stringify(created)).not.toContain("visitor_other_subject");
  });

  test("applies the same subject binding in the shared API dispatcher", () => {
    clearLaunchOpsForTests();

    const response = handleApiRequest(
      "POST",
      "/api/privacy/delete-request",
      {
        member_id: "member_other_subject",
        visitor_id: "visitor_other_subject",
        scope: "birth_data",
        message: "spoof via shared dispatcher"
      },
      {
        identity: {
          memberId: "member_api_subject",
          visitorId: "visitor_api_subject"
        }
      }
    );

    expect(response.status).toBe(403);
    expect(response.body.error).toMatchObject({ code: "DELETION_SUBJECT_FORBIDDEN", field: "member_id" });
  });

  test("rejects deletion requests that do not have an existing visitor or member identity", async () => {
    clearLaunchOpsForTests();

    const routeResponse = await privacyDeletePost(
      new Request("http://localhost:3000/api/privacy/delete-request", {
        method: "POST",
        headers: {
          origin: "http://localhost:3000",
          "content-type": "application/json"
        },
        body: JSON.stringify({
          scope: "reports",
          message: "delete my reports"
        })
      })
    );
    const routeBody = await routeResponse.json();
    const dispatcherResponse = handleApiRequest("POST", "/api/privacy/delete-request", {
      scope: "reports",
      message: "delete my reports"
    });

    expect(routeResponse.status).toBe(401);
    expect(routeBody.error).toMatchObject({ code: "DELETION_IDENTITY_REQUIRED", field: "session" });
    expect(dispatcherResponse.status).toBe(401);
    expect(dispatcherResponse.body.error).toMatchObject({ code: "DELETION_IDENTITY_REQUIRED", field: "session" });
  });
});
