import { handleApiRequest } from "../../../../api.js";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(request: Request, context: RouteContext): Promise<Response> {
  const { id } = await context.params;
  const url = new URL(request.url);
  const response = handleApiRequest("GET", `/api/star-atlas/${id}${url.search}`);
  return Response.json(response.body, { status: response.status });
}
