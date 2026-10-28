import { handleApiRequest } from "../../../../api.js";
import { getCommerceSubjectId, getRequestIdentity } from "../../../../auth.js";

export async function GET(request: Request): Promise<Response> {
  const identity = getRequestIdentity(request);
  const params = new URLSearchParams({ member_id: getCommerceSubjectId(identity) });
  const response = handleApiRequest("GET", `/api/member/me?${params.toString()}`);
  return Response.json(response.body, { status: response.status });
}
