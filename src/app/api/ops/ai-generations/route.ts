import { handleApiRequest } from "../../../../api.js";

export async function GET(request: Request): Promise<Response> {
  const response = handleApiRequest("GET", `/api/ops/ai-generations${opsQuery(request)}`);
  return Response.json(response.body, { status: response.status });
}

function opsQuery(request: Request): string {
  const url = new URL(request.url);
  url.searchParams.set("admin_token", request.headers.get("x-admin-token") ?? url.searchParams.get("admin_token") ?? "");
  url.searchParams.set("admin_role", request.headers.get("x-admin-role") ?? url.searchParams.get("admin_role") ?? "content_reviewer");
  url.searchParams.set("actor_id", request.headers.get("x-admin-actor") ?? url.searchParams.get("actor_id") ?? "ops_ai_route");
  url.searchParams.set("admin_mfa_code", request.headers.get("x-admin-mfa-code") ?? url.searchParams.get("admin_mfa_code") ?? "");
  return `?${url.searchParams.toString()}`;
}
