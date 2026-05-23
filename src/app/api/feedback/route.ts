import { handleApiRequest } from "../../../api.js";

export async function POST(request: Request): Promise<Response> {
  const body = await request.json();
  const response = handleApiRequest("POST", "/api/feedback", body);
  return Response.json(response.body, { status: response.status });
}

export async function GET(): Promise<Response> {
  const response = handleApiRequest("GET", "/api/feedback");
  return Response.json(response.body, { status: response.status });
}
