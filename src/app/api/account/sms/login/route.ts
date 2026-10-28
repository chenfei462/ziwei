import { loginWithSmsVerification } from "../../../../../accountAuth.js";
import { readProtectedJson } from "../../../../../apiRouteGuard.js";
import { buildMemberCookieHeader, buildVisitorCookieHeader, getOrCreateRequestIdentity } from "../../../../../auth.js";
import { toErrorEnvelope } from "../../../../../errors.js";

type SmsLoginBody = {
  phone?: string;
  code?: string;
  display_name?: string;
};

export async function POST(request: Request): Promise<Response> {
  try {
    const body = (await readProtectedJson(request, { limit: 10 })) as SmsLoginBody;
    const { identity, shouldSetVisitorCookie } = getOrCreateRequestIdentity(request);
    const response = await loginWithSmsVerification({
      phone: body.phone ?? "",
      code: body.code ?? "",
      display_name: body.display_name,
      visitor_id: identity.visitorId,
      member_id: identity.memberId
    });
    return Response.json(response, {
      status: 200,
      headers: buildAccountCookieHeaders(identity.visitorId, response.user.member_id, shouldSetVisitorCookie, new URL(request.url).protocol === "https:")
    });
  } catch (error) {
    const response = toErrorEnvelope(error);
    return Response.json(response.body, { status: response.status });
  }
}

function buildAccountCookieHeaders(visitorId: string, memberId: string, includeVisitorCookie: boolean, secure: boolean): Headers {
  const headers = new Headers();
  if (includeVisitorCookie) headers.append("set-cookie", buildVisitorCookieHeader(visitorId, { secure }));
  headers.append("set-cookie", buildMemberCookieHeader(memberId, { secure }));
  return headers;
}
