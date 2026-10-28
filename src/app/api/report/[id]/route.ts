import { handleApiRequest } from "../../../../api.js";
import { getRequestIdentity } from "../../../../auth.js";
import { toErrorEnvelope } from "../../../../errors.js";
import { assertCanReadReportAsync } from "../../../../reportAccess.js";
import type { ReportDraft } from "../../../../types.js";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(request: Request, context: RouteContext): Promise<Response> {
  try {
    const { id } = await context.params;
    const response = handleApiRequest("GET", `/api/report/${id}`);
    if (response.status !== 200) {
      return Response.json(response.body, { status: response.status });
    }
    await assertCanReadReportAsync(response.body as unknown as ReportDraft, getRequestIdentity(request));
    return Response.json(response.body, { status: response.status });
  } catch (error) {
    const response = toErrorEnvelope(error);
    return Response.json(response.body, { status: response.status });
  }
}
