import { handleApiRequest } from "../../../../../../api.js";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(request: Request, context: RouteContext): Promise<Response> {
  const { id } = await context.params;
  const response = handleApiRequest("GET", `/api/ops/immersive/session/${id}${opsQuery(request)}`);
  return Response.json(response.body, { status: response.status });
}

function opsQuery(request: Request): string {
  const url = new URL(request.url);
  url.searchParams.set("admin_token", request.headers.get("x-admin-token") ?? "");
  url.searchParams.set("admin_role", request.headers.get("x-admin-role") ?? "support_agent");
  url.searchParams.set("actor_id", request.headers.get("x-admin-actor") ?? "ops_immersive_session_read_route");
  url.searchParams.set("admin_mfa_code", request.headers.get("x-admin-mfa-code") ?? "");
  return `?${url.searchParams.toString()}`;
}
