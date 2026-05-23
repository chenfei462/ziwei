import { handleApiRequest } from "../../../../api.js";

export async function POST(request: Request): Promise<Response> {
  const body = await request.json();
  const response = handleApiRequest("POST", "/api/order/create", body);
  return Response.json(response.body, { status: response.status });
}
