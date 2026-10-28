import { assertCanReadChart, getCommerceSubjectId, type RequestIdentity } from "./auth.js";
import { ApiError } from "./errors.js";
import { getReportEntitlement } from "./phase9/commerce.js";
import { productRepository } from "./repositories/productRepository.js";
import type { ReportDraft } from "./types.js";

export function assertCanReadReport(report: ReportDraft, identity: RequestIdentity): void {
  const subjectId = getCommerceSubjectId(identity);
  const entitlement = getReportEntitlement(report.report_id, subjectId);
  if (entitlement.has_access && entitlement.can_read_report) return;

  if (!report.access?.entitlement_required_for_private_sections) {
    assertCanReadReportOwner(report, identity);
    return;
  }

  throw new ApiError("REPORT_ACCESS_FORBIDDEN", "你无权访问该报告。", { field: "report_id", status: 403 });
}

export function assertCanCreateReportSummaryShare(report: ReportDraft, identity: RequestIdentity): void {
  const subjectId = getCommerceSubjectId(identity);
  const entitlement = getReportEntitlement(report.report_id, subjectId);
  if (entitlement.has_access) return;
  if (report.access?.free_summary_enabled) {
    assertCanReadReportOwner(report, identity);
    return;
  }
  throw new ApiError("REPORT_ACCESS_FORBIDDEN", "你无权访问该报告。", { field: "report_id", status: 403 });
}

export async function canReadReportSummaryAsync(report: ReportDraft, identity: RequestIdentity): Promise<boolean> {
  const subjectId = getCommerceSubjectId(identity);
  const entitlement = getReportEntitlement(report.report_id, subjectId);
  if (entitlement.has_access) return true;
  if (!report.access?.free_summary_enabled) return false;
  try {
    await assertCanReadReportOwnerAsync(report, identity);
    return true;
  } catch {
    return false;
  }
}

function assertCanReadReportOwner(report: ReportDraft, identity: RequestIdentity): void {
  const chartId = report.chart_ref?.chart_id;
  if (chartId) {
    try {
      assertCanReadChart(productRepository.getChartOwner(chartId), identity);
      return;
    } catch {
      // Fall through to a report-scoped error so private report access never reveals chart ownership detail.
    }
  }

  throw new ApiError("REPORT_ACCESS_FORBIDDEN", "你无权访问该报告。", { field: "report_id", status: 403 });
}

export async function assertCanReadReportAsync(report: ReportDraft, identity: RequestIdentity): Promise<void> {
  const subjectId = getCommerceSubjectId(identity);
  const entitlement = getReportEntitlement(report.report_id, subjectId);
  if (entitlement.has_access && entitlement.can_read_report) return;

  if (!report.access?.entitlement_required_for_private_sections) {
    await assertCanReadReportOwnerAsync(report, identity);
    return;
  }

  throw new ApiError("REPORT_ACCESS_FORBIDDEN", "你无权访问该报告。", { field: "report_id", status: 403 });
}

export async function assertCanCreateReportSummaryShareAsync(report: ReportDraft, identity: RequestIdentity): Promise<void> {
  const subjectId = getCommerceSubjectId(identity);
  const entitlement = getReportEntitlement(report.report_id, subjectId);
  if (entitlement.has_access) return;
  if (report.access?.free_summary_enabled) {
    await assertCanReadReportOwnerAsync(report, identity);
    return;
  }
  throw new ApiError("REPORT_ACCESS_FORBIDDEN", "你无权访问该报告。", { field: "report_id", status: 403 });
}

async function assertCanReadReportOwnerAsync(report: ReportDraft, identity: RequestIdentity): Promise<void> {
  const chartId = report.chart_ref?.chart_id;
  if (chartId) {
    try {
      assertCanReadChart(await productRepository.getChartOwnerAsync(chartId), identity);
      return;
    } catch {
      // Fall through to a report-scoped error so private report access never reveals chart ownership detail.
    }
  }

  throw new ApiError("REPORT_ACCESS_FORBIDDEN", "你无权访问该报告。", { field: "report_id", status: 403 });
}
