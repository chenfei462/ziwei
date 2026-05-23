import { handleApiRequest } from "../../../../api.js";

export async function POST(request: Request): Promise<Response> {
  const body = await request.json();
  const response = handleApiRequest("POST", "/api/mini-program/link-member", body);
  return Response.json(response.body, { status: response.status });
}
