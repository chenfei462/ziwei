import { handleApiRequest } from "../../../../api.js";
import { jsonErrorResponse, readProtectedJson } from "../../../../apiRouteGuard.js";

export async function POST(request: Request): Promise<Response> {
  try {
    const body = (await readProtectedJson(request)) as Record<string, unknown>;
    const response = handleApiRequest("POST", "/api/ops/internal-feedback", {
      ...body,
      auth: opsAuth(request)
    });
    return Response.json(response.body, { status: response.status });
  } catch (error) {
    return jsonErrorResponse(error);
  }
}

export async function GET(request: Request): Promise<Response> {
  const response = handleApiRequest("GET", `/api/ops/internal-feedback${opsQuery(request)}`);
  return Response.json(response.body, { status: response.status });
}

function opsAuth(request: Request) {
  return {
    token: request.headers.get("x-admin-token") ?? "",
    role: request.headers.get("x-admin-role") ?? "support_agent",
    actor_id: request.headers.get("x-admin-actor") ?? "internal_feedback_route",
    mfa_code: request.headers.get("x-admin-mfa-code") ?? ""
  };
}

function opsQuery(request: Request): string {
  const url = new URL(request.url);
  url.searchParams.set("admin_token", request.headers.get("x-admin-token") ?? "");
  url.searchParams.set("admin_role", request.headers.get("x-admin-role") ?? "support_agent");
  url.searchParams.set("actor_id", request.headers.get("x-admin-actor") ?? "internal_feedback_route");
  url.searchParams.set("admin_mfa_code", request.headers.get("x-admin-mfa-code") ?? "");
  return `?${url.searchParams.toString()}`;
}
