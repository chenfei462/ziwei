import { handleApiRequest } from "../../../../../../../api.js";
import { jsonErrorResponse, readProtectedJson } from "../../../../../../../apiRouteGuard.js";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(request: Request, context: RouteContext): Promise<Response> {
  try {
    const { id } = await context.params;
    const body = (await readProtectedJson(request)) as Record<string, unknown>;
    const response = handleApiRequest("POST", `/api/ops/immersive/session/${id}/event`, {
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
    role: request.headers.get("x-admin-role") ?? "support_agent",
    actor_id: request.headers.get("x-admin-actor") ?? "ops_immersive_event_route",
    mfa_code: request.headers.get("x-admin-mfa-code") ?? ""
  };
}
