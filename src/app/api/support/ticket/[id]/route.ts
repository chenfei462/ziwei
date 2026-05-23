import { handleApiRequest } from "../../../../../api.js";
import { ApiError, toErrorEnvelope } from "../../../../../errors.js";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(request: Request, context: RouteContext): Promise<Response> {
  const { id } = await context.params;
  const url = new URL(request.url);
  url.searchParams.set("admin_token", request.headers.get("x-admin-token") ?? "");
  url.searchParams.set("admin_role", request.headers.get("x-admin-role") ?? "support_agent");
  const response = handleApiRequest("GET", `/api/support/ticket/${id}?${url.searchParams.toString()}`);
  return Response.json(response.body, { status: response.status });
}

export async function PATCH(request: Request, context: RouteContext): Promise<Response> {
  const { id } = await context.params;
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    const response = toErrorEnvelope(new ApiError("INVALID_JSON", "Request body must be valid JSON."));
    return Response.json(response.body, { status: response.status });
  }
  const response = handleApiRequest("PATCH", `/api/support/ticket/${id}`, {
    ...body,
    auth: {
      token: request.headers.get("x-admin-token") ?? "",
      role: request.headers.get("x-admin-role") ?? "support_agent"
    }
  });
  return Response.json(response.body, { status: response.status });
}
