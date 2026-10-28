import { persistAnonymousMemberLink } from "../../../../accountLinking.js";
import { jsonErrorResponse, readProtectedJson } from "../../../../apiRouteGuard.js";
import { buildMemberCookieHeader, buildVisitorCookieHeader, getOrCreateRequestIdentity } from "../../../../auth.js";
import { linkAnonymousMember } from "../../../../phase14/channels.js";
import type { AnonymousLinkRequest } from "../../../../types.js";

export async function POST(request: Request): Promise<Response> {
  try {
    const body = (await readProtectedJson(request)) as AnonymousLinkRequest;
    const { identity, shouldSetVisitorCookie } = getOrCreateRequestIdentity(request);
    const memberId = identity.memberId ?? createMemberId(identity.visitorId);
    const response = linkAnonymousMember({
      ...body,
      visitor_id: identity.visitorId,
      member_id: memberId
    });
    await persistAnonymousMemberLink(response);
    return Response.json(response, {
      status: 201,
      headers: buildLinkCookieHeaders(identity.visitorId, memberId, shouldSetVisitorCookie, new URL(request.url).protocol === "https:")
    });
  } catch (error) {
    return jsonErrorResponse(error);
  }
}

function buildLinkCookieHeaders(visitorId: string, memberId: string, includeVisitorCookie: boolean, secure: boolean): Headers {
  const headers = new Headers();
  if (includeVisitorCookie) headers.append("set-cookie", buildVisitorCookieHeader(visitorId, { secure }));
  headers.append("set-cookie", buildMemberCookieHeader(memberId, { secure }));
  return headers;
}

function createMemberId(visitorId: string): string {
  const suffix = visitorId.replace(/[^a-zA-Z0-9]/g, "").slice(-18) || crypto.randomUUID().replace(/-/g, "").slice(0, 18);
  return `member_${suffix}`;
}
