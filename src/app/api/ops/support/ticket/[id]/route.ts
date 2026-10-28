import { handleApiRequest } from "../../../../../../api.js";
import { jsonErrorResponse, readProtectedJson } from "../../../../../../apiRouteGuard.js";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(request: Request, context: RouteContext): Promise<Response> {
  const { id } = await context.params;
  const url = new URL(request.url);
  url.searchParams.set("admin_token", request.headers.get("x-admin-token") ?? "");
  url.searchParams.set("admin_role", request.headers.get("x-admin-role") ?? "support_agent");
  url.searchParams.set("actor_id", request.headers.get("x-admin-actor") ?? "ops_support_ticket_route");
  url.searchParams.set("admin_mfa_code", request.headers.get("x-admin-mfa-code") ?? "");
  const response = handleApiRequest("GET", `/api/ops/support/ticket/${id}?${url.searchParams.toString()}`);
  return Response.json(response.body, { status: response.status });
}

export async function PATCH(request: Request, context: RouteContext): Promise<Response> {
  try {
    const { id } = await context.params;
    const body = (await readProtectedJson(request)) as Record<string, unknown>;
    const response = handleApiRequest("PATCH", `/api/ops/support/ticket/${id}`, {
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
    actor_id: request.headers.get("x-admin-actor") ?? "ops_support_ticket_route",
    mfa_code: request.headers.get("x-admin-mfa-code") ?? ""
  };
}
