import { getRequestIdentity } from "../../../../auth.js";
import { jsonErrorResponse, readProtectedJson } from "../../../../apiRouteGuard.js";
import { answerFollowUpAsync } from "../../../../phase3/followUp.js";
import type { FollowUpRequest } from "../../../../types.js";

export async function POST(request: Request): Promise<Response> {
  try {
    const body = (await readProtectedJson(request, { limit: 30 })) as FollowUpRequest;
    const response = await answerFollowUpAsync(body, getRequestIdentity(request));
    return Response.json(response, { status: 200 });
  } catch (error) {
    return jsonErrorResponse(error);
  }
}
