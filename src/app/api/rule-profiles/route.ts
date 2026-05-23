import { handleApiRequest } from "../../../api.js";

export async function GET(): Promise<Response> {
  const response = handleApiRequest("GET", "/api/rule-profiles");
  return Response.json(response.body, { status: response.status });
}
