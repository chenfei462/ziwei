import { handleApiRequest } from "../../../../../api.js";

type RouteContext = {
  params: Promise<{ report_id: string }>;
};

export async function GET(request: Request, context: RouteContext): Promise<Response> {
  const { report_id } = await context.params;
  const url = new URL(request.url);
  const response = handleApiRequest("GET", `/api/entitlement/report/${report_id}${url.search}`);
  return Response.json(response.body, { status: response.status });
}
