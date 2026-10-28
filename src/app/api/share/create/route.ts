import { handleApiRequest } from "../../../../api.js";
import { readProtectedJson } from "../../../../apiRouteGuard.js";
import { recordProductEvent } from "../../../../analytics.js";
import { buildVisitorCookieHeader, getCommerceSubjectId, getOrCreateRequestIdentity } from "../../../../auth.js";
import { toErrorEnvelope } from "../../../../errors.js";
import type { ShareCreateResponse } from "../../../../types.js";

export async function POST(request: Request): Promise<Response> {
  try {
    const body = (await readProtectedJson(request)) as Record<string, unknown>;
    const { identity, shouldSetVisitorCookie } = getOrCreateRequestIdentity(request);
    const response = handleApiRequest("POST", "/api/share/create", {
      ...body,
      member_id: getCommerceSubjectId(identity),
      visitor_id: identity.visitorId
    });
    if (response.status === 201) {
      const share = response.body as unknown as Partial<ShareCreateResponse>;
      recordProductEvent("share_created", {
        identity,
        share_id: share.snapshot?.share_id,
        chart_id: share.snapshot?.source_id,
        metadata: { source_type: share.snapshot?.source_type ?? "unknown" }
      });
    }
    return Response.json(response.body, {
      status: response.status,
      headers: shouldSetVisitorCookie ? { "set-cookie": buildVisitorCookieHeader(identity.visitorId, { secure: new URL(request.url).protocol === "https:" }) } : undefined
    });
  } catch (error) {
    const response = toErrorEnvelope(error);
    return Response.json(response.body, { status: response.status });
  }
}
