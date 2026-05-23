import { handleApiRequest } from "../../../../api.js";

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const response = handleApiRequest("GET", `/api/knowledge/search?${url.searchParams.toString()}`);
  return Response.json(response.body, { status: response.status });
}
