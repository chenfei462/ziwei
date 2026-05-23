import { handleApiRequest } from "../../../../api.js";

export async function GET(): Promise<Response> {
  const response = handleApiRequest("GET", "/api/launch/config");
  return Response.json(response.body, { status: response.status });
}
