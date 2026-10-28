import { handleApiRequest } from "../../../../api.js";
import { jsonErrorResponse, readProtectedJson } from "../../../../apiRouteGuard.js";
import { getCommerceSubjectId, getRequestIdentity } from "../../../../auth.js";

export async function POST(request: Request): Promise<Response> {
  try {
    const body = (await readProtectedJson(request)) as Record<string, unknown>;
    const response = handleApiRequest("POST", "/api/challenge/join", {
      ...body,
      member_id: getCommerceSubjectId(getRequestIdentity(request))
    });
    return Response.json(response.body, { status: response.status });
  } catch (error) {
    return jsonErrorResponse(error);
  }
}
