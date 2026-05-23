import { handleApiRequest } from "../../../../api.js";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, context: RouteContext): Promise<Response> {
  const { id } = await context.params;
  const response = handleApiRequest("GET", `/api/report/${id}`);
  return Response.json(response.body, { status: response.status });
}
