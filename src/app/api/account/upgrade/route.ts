import { readProtectedJson } from "../../../../apiRouteGuard.js";
import { persistAnonymousMemberLink } from "../../../../accountLinking.js";
import { buildMemberCookieHeader, buildVisitorCookieHeader, getOrCreateRequestIdentity } from "../../../../auth.js";
import { toErrorEnvelope } from "../../../../errors.js";
import { linkAnonymousMember } from "../../../../phase14/channels.js";

type AccountUpgradeBody = {
  email?: string;
  phone?: string;
  display_name?: string;
};

export async function POST(request: Request): Promise<Response> {
  try {
    const body = (await readProtectedJson(request)) as AccountUpgradeBody;
    const { identity, shouldSetVisitorCookie } = getOrCreateRequestIdentity(request);
    const memberId = identity.memberId ?? createMemberId(identity.visitorId);
    const response = linkAnonymousMember({
      visitor_id: identity.visitorId,
      member_id: memberId,
      email: body.email,
      phone: body.phone,
      display_name: body.display_name
    });
    await persistAnonymousMemberLink(response);
    return Response.json(response, {
      status: 201,
      headers: buildAccountCookieHeaders(identity.visitorId, memberId, shouldSetVisitorCookie)
    });
  } catch (error) {
    const response = toErrorEnvelope(error);
    return Response.json(response.body, { status: response.status });
  }
}

function buildAccountCookieHeaders(visitorId: string, memberId: string, includeVisitorCookie: boolean): Headers {
  const headers = new Headers();
  if (includeVisitorCookie) headers.append("set-cookie", buildVisitorCookieHeader(visitorId));
  headers.append("set-cookie", buildMemberCookieHeader(memberId));
  return headers;
}

function createMemberId(visitorId: string): string {
  const suffix = visitorId.replace(/[^a-zA-Z0-9]/g, "").slice(-18) || crypto.randomUUID().replace(/-/g, "").slice(0, 18);
  return `member_${suffix}`;
}
