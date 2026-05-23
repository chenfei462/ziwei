import { handleApiRequest } from "../../../../api.js";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }): Promise<Response> {
  const { id } = await context.params;
  const response = handleApiRequest("GET", `/api/chart/${id}`);
  return Response.json(response.body, { status: response.status });
}
