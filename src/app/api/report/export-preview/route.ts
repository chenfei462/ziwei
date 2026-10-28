import { handleApiRequest } from "../../../../api.js";
import { readProtectedJson } from "../../../../apiRouteGuard.js";
import { getRequestIdentity } from "../../../../auth.js";
import { toErrorEnvelope } from "../../../../errors.js";
import { getReportDraft } from "../../../../phase8/reporting.js";
import { assertCanReadReportAsync } from "../../../../reportAccess.js";

export async function POST(request: Request): Promise<Response> {
  try {
    const body = (await readProtectedJson(request)) as Partial<{ report_id: string; format: string }>;
    await assertReportExportAccess(request, body.report_id);
    const response = handleApiRequest("POST", "/api/report/export-preview", body);
    return Response.json(response.body, { status: response.status });
  } catch (error) {
    const response = toErrorEnvelope(error);
    return Response.json(response.body, { status: response.status });
  }
}

export async function GET(request: Request): Promise<Response> {
  try {
    const url = new URL(request.url);
    const body = {
      report_id: url.searchParams.get("report_id") ?? "",
      format: url.searchParams.get("format") ?? "html"
    };
    await assertReportExportAccess(request, body.report_id);
    const response = handleApiRequest("POST", "/api/report/export-preview", body);
    return Response.json(response.body, { status: response.status });
  } catch (error) {
    const response = toErrorEnvelope(error);
    return Response.json(response.body, { status: response.status });
  }
}

async function assertReportExportAccess(request: Request, reportId: string | undefined): Promise<void> {
  const report = reportId ? getReportDraft(reportId) : undefined;
  if (report) {
    await assertCanReadReportAsync(report, getRequestIdentity(request));
  }
}
