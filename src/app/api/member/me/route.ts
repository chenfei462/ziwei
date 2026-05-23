import { handleApiRequest } from "../../../../api.js";

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const response = handleApiRequest("GET", `/api/member/me${url.search}`);
  return Response.json(response.body, { status: response.status });
}
