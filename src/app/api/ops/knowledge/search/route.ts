import { handleApiRequest } from "../../../../../api.js";

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  url.searchParams.set("admin_token", request.headers.get("x-admin-token") ?? "");
  url.searchParams.set("admin_role", request.headers.get("x-admin-role") ?? "content_reviewer");
  url.searchParams.set("actor_id", request.headers.get("x-admin-actor") ?? "ops_knowledge_search_route");
  url.searchParams.set("admin_mfa_code", request.headers.get("x-admin-mfa-code") ?? "");
  const response = handleApiRequest("GET", `/api/ops/knowledge/search?${url.searchParams.toString()}`);
  return Response.json(response.body, { status: response.status });
}
