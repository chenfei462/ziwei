import { handleApiRequest } from "../../../../../../../api.js";
import { ApiError, toErrorEnvelope } from "../../../../../../../errors.js";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(request: Request, context: RouteContext): Promise<Response> {
  const { id } = await context.params;
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    const response = toErrorEnvelope(new ApiError("INVALID_JSON", "Request body must be valid JSON."));
    return Response.json(response.body, { status: response.status });
  }
  const response = handleApiRequest("POST", `/api/ops/order/${id}/entitlement/reissue`, {
    ...body,
    auth: opsAuth(request)
  });
  return Response.json(response.body, { status: response.status });
}

function opsAuth(request: Request) {
  return {
    token: request.headers.get("x-admin-token") ?? "",
    role: request.headers.get("x-admin-role") ?? "support_agent",
    actor_id: request.headers.get("x-admin-actor") ?? "ops_reissue_route",
    mfa_code: request.headers.get("x-admin-mfa-code") ?? ""
  };
}
