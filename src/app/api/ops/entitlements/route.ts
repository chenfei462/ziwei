import { handleApiRequest } from "../../../../api.js";

export async function GET(request: Request): Promise<Response> {
  const response = handleApiRequest("GET", `/api/ops/entitlements${opsQuery(request)}`);
  return Response.json(response.body, { status: response.status });
}

function opsQuery(request: Request): string {
  const url = new URL(request.url);
  url.searchParams.set("admin_token", request.headers.get("x-admin-token") ?? "");
  url.searchParams.set("admin_role", request.headers.get("x-admin-role") ?? "support_agent");
  url.searchParams.set("admin_mfa_code", request.headers.get("x-admin-mfa-code") ?? "");
  return `?${url.searchParams.toString()}`;
}
