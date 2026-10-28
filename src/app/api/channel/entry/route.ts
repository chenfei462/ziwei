import { handleApiRequest } from "../../../../api.js";
import { jsonErrorResponse, readProtectedJson } from "../../../../apiRouteGuard.js";
import { buildVisitorCookieHeader, getOrCreateRequestIdentity } from "../../../../auth.js";

export async function POST(request: Request): Promise<Response> {
  try {
    const body = (await readProtectedJson(request)) as Record<string, unknown>;
    const { identity, shouldSetVisitorCookie } = getOrCreateRequestIdentity(request);
    const response = handleApiRequest("POST", "/api/channel/entry", {
      ...body,
      visitor_id: identity.visitorId
    });
    return Response.json(response.body, {
      status: response.status,
      headers: shouldSetVisitorCookie ? { "set-cookie": buildVisitorCookieHeader(identity.visitorId, { secure: new URL(request.url).protocol === "https:" }) } : undefined
    });
  } catch (error) {
    return jsonErrorResponse(error);
  }
}
