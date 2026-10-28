import { handleApiRequest } from "../../../../api.js";
import { readProtectedJson } from "../../../../apiRouteGuard.js";
import { getRequestIdentity } from "../../../../auth.js";
import { toErrorEnvelope } from "../../../../errors.js";

export async function POST(request: Request): Promise<Response> {
  try {
    const body = await readProtectedJson(request);
    const response = handleApiRequest("POST", "/api/support/ticket", body, { identity: getRequestIdentity(request) });
    return Response.json(response.body, { status: response.status });
  } catch (error) {
    const response = toErrorEnvelope(error);
    return Response.json(response.body, { status: response.status });
  }
}
