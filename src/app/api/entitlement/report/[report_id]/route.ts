import { handleApiRequest } from "../../../../../api.js";
import { getCommerceSubjectId, getRequestIdentity } from "../../../../../auth.js";

type RouteContext = {
  params: Promise<{ report_id: string }>;
};

export async function GET(request: Request, context: RouteContext): Promise<Response> {
  const { report_id } = await context.params;
  const identity = getRequestIdentity(request);
  const params = new URLSearchParams({ member_id: getCommerceSubjectId(identity) });
  const response = handleApiRequest("GET", `/api/entitlement/report/${report_id}?${params.toString()}`);
  return Response.json(response.body, { status: response.status });
}
