import { handleApiRequest } from "../../../../../api.js";
import { jsonErrorResponse, readProtectedJson } from "../../../../../apiRouteGuard.js";

export async function POST(request: Request): Promise<Response> {
  try {
    const body = (await readProtectedJson(request)) as Record<string, unknown>;
    const response = handleApiRequest("POST", "/api/ops/synastry/create", {
      ...body,
      auth: opsAuth(request)
    });
    return Response.json(response.body, { status: response.status });
  } catch (error) {
    return jsonErrorResponse(error);
  }
}

function opsAuth(request: Request) {
  return {
    token: request.headers.get("x-admin-token") ?? "",
    role: request.headers.get("x-admin-role") ?? "content_reviewer",
    actor_id: request.headers.get("x-admin-actor") ?? "ops_synastry_route",
    mfa_code: request.headers.get("x-admin-mfa-code") ?? ""
  };
}
