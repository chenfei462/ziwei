import { handleApiRequest } from "../../../../api.js";
import { jsonErrorResponse, readProtectedJson } from "../../../../apiRouteGuard.js";
import { buildMemberCookieHeader, buildVisitorCookieHeader, getOrCreateRequestIdentity } from "../../../../auth.js";
import type { MiniProgramLoginResponse } from "../../../../types.js";

export async function POST(request: Request): Promise<Response> {
  try {
    const body = (await readProtectedJson(request)) as Record<string, unknown>;
    const { identity, shouldSetVisitorCookie } = getOrCreateRequestIdentity(request);
    const response = handleApiRequest("POST", "/api/mini-program/login", {
      ...body,
      visitor_id: identity.visitorId,
      member_id: identity.memberId
    });
    return Response.json(response.body, {
      status: response.status,
      headers: buildSessionHeaders({
        request,
        responseBody: response.body,
        includeVisitorCookie: shouldSetVisitorCookie
      })
    });
  } catch (error) {
    return jsonErrorResponse(error);
  }
}

function buildSessionHeaders(input: {
  request: Request;
  responseBody: Record<string, unknown>;
  includeVisitorCookie: boolean;
}): Headers | undefined {
  if (input.includeVisitorCookie || input.responseBody.session) {
    const headers = new Headers();
    const secure = new URL(input.request.url).protocol === "https:";
    const login = input.responseBody as unknown as Partial<MiniProgramLoginResponse>;
    if (input.includeVisitorCookie && login.session?.visitor_id) {
      headers.append("set-cookie", buildVisitorCookieHeader(login.session.visitor_id, { secure }));
    }
    if (login.session?.member_id) {
      headers.append("set-cookie", buildMemberCookieHeader(login.session.member_id, { secure }));
    }
    return headers;
  }
  return undefined;
}
