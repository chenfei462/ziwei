import { handleApiRequest } from "../../../../api.js";

export async function GET(): Promise<Response> {
  const response = handleApiRequest("GET", "/api/beta/dashboard");
  return Response.json(response.body, { status: response.status });
}
