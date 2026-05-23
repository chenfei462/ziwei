import { handleApiRequest } from "../../../../api.js";

export async function GET(_request?: Request): Promise<Response> {
  const response = handleApiRequest("GET", "/api/growth/channel-dashboard");
  return Response.json(response.body, { status: response.status });
}
