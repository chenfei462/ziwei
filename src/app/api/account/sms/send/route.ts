import { requestSmsVerification } from "../../../../../accountAuth.js";
import { jsonErrorResponse, readProtectedJson } from "../../../../../apiRouteGuard.js";

export async function POST(request: Request): Promise<Response> {
  try {
    const body = await readProtectedJson(request, { limit: 10 });
    const response = await requestSmsVerification(body as { phone: string });
    return Response.json(response, { status: 202 });
  } catch (error) {
    return jsonErrorResponse(error);
  }
}
