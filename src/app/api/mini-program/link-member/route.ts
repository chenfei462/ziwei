import { handleApiRequest } from "../../../../api.js";
import { jsonErrorResponse, readProtectedJson } from "../../../../apiRouteGuard.js";
import { getCommerceSubjectId, getRequestIdentity } from "../../../../auth.js";

export async function POST(request: Request): Promise<Response> {
  try {
    const body = (await readProtectedJson(request)) as Record<string, unknown>;
    const identity = getRequestIdentity(request);
    const response = handleApiRequest("POST", "/api/mini-program/link-member", {
      ...body,
      visitor_id: identity.visitorId,
      member_id: getCommerceSubjectId(identity)
    });
    return Response.json(response.body, { status: response.status });
  } catch (error) {
    return jsonErrorResponse(error);
  }
}
