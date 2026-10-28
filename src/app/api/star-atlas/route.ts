import { handleApiRequest } from "../../../api.js";
import { getCommerceSubjectId, getRequestIdentity } from "../../../auth.js";

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  url.searchParams.set("member_id", getCommerceSubjectId(getRequestIdentity(request)));
  const response = handleApiRequest("GET", `/api/star-atlas${url.search}`);
  return Response.json(response.body, { status: response.status });
}
