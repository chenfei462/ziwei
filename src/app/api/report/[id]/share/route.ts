import { handleApiRequest } from "../../../../../api.js";
import { getRequestIdentity } from "../../../../../auth.js";
import { toErrorEnvelope } from "../../../../../errors.js";
import { getReportDraft } from "../../../../../phase8/reporting.js";
import { assertCanCreateReportSummaryShareAsync } from "../../../../../reportAccess.js";
import type { ReportDraft } from "../../../../../types.js";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(request: Request, context: RouteContext): Promise<Response> {
  try {
    const { id } = await context.params;
    const report = getReportDraft(id);
    if (!report) {
      const missing = handleApiRequest("GET", `/api/report/${id}`);
      return Response.json(missing.body, { status: missing.status });
    }
    await assertCanCreateReportSummaryShareAsync(report, getRequestIdentity(request));
    const response = handleApiRequest("POST", "/api/share/create", buildReportShareRequest(report));
    return Response.json(response.body, { status: response.status });
  } catch (error) {
    const response = toErrorEnvelope(error);
    return Response.json(response.body, { status: response.status });
  }
}

function buildReportShareRequest(report: ReportDraft) {
  const summary = report.share_summary;
  return {
    source_type: "report_summary",
    source_id: report.report_id,
    title: summary?.title ?? `${report.title} 摘要`,
    summary: summary?.summary ?? "公开分享仅展示脱敏摘要，完整报告需本人权限或付费权益访问。",
    keywords: [report.report_type, report.mode, report.template_version, `v${report.report_version ?? 1}`],
    safety_flags: summary?.safety_flags ?? report.safety_flags
  };
}
