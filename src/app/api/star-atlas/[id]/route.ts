import { handleApiRequest } from "../../../../api.js";
import { getCommerceSubjectId, getRequestIdentity } from "../../../../auth.js";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(request: Request, context: RouteContext): Promise<Response> {
  const { id } = await context.params;
  const url = new URL(request.url);
  url.searchParams.set("member_id", getCommerceSubjectId(getRequestIdentity(request)));
  const response = handleApiRequest("GET", `/api/star-atlas/${id}${url.search}`);
  return Response.json(response.body, { status: response.status });
}
