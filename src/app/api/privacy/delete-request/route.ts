import { jsonErrorResponse, readProtectedJson } from "../../../../apiRouteGuard.js";
import { getRequestIdentity } from "../../../../auth.js";
import { ApiError } from "../../../../errors.js";
import { createPrivacyDeletionRequest } from "../../../../phase10/launchOps.js";
import type { DataDeletionScope } from "../../../../types.js";

export async function POST(request: Request): Promise<Response> {
  try {
    const body = (await readProtectedJson(request)) as {
      member_id?: string;
      visitor_id?: string;
      scope?: DataDeletionScope;
      message?: string;
    };
    const identity = getRequestIdentity(request);
    assertDeletionSubjectMatchesRequestIdentity(body, identity);
    const response = createPrivacyDeletionRequest({
      member_id: identity.memberId,
      visitor_id: identity.visitorId,
      scope: body.scope,
      message: body.message
    });

    return Response.json(response, { status: 201 });
  } catch (error) {
    return jsonErrorResponse(error);
  }
}

function assertDeletionSubjectMatchesRequestIdentity(
  body: { member_id?: string; visitor_id?: string },
  identity: { memberId?: string; visitorId: string }
): void {
  if (!identity.memberId && identity.visitorId === "visitor_guest") {
    throw new ApiError("DELETION_IDENTITY_REQUIRED", "data deletion requests require an existing visitor or member session.", {
      field: "session",
      status: 401
    });
  }
  if (body.member_id && body.member_id !== identity.memberId) {
    throw new ApiError("DELETION_SUBJECT_FORBIDDEN", "deletion request subject must match the current signed-in member.", {
      field: "member_id",
      status: 403
    });
  }
  if (body.visitor_id && body.visitor_id !== identity.visitorId) {
    throw new ApiError("DELETION_SUBJECT_FORBIDDEN", "deletion request visitor subject must match the current anonymous visitor.", {
      field: "visitor_id",
      status: 403
    });
  }
}
