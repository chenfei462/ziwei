import { summarizeProductAnalytics } from "../../../../../analytics.js";
import { ApiError } from "../../../../../errors.js";
import { jsonErrorResponse } from "../../../../../apiRouteGuard.js";
import { getConfiguredOpsToken } from "../../../../../phase10/launchOps.js";

export async function GET(request: Request): Promise<Response> {
  try {
    assertOpsAuth(request);
    return Response.json(summarizeProductAnalytics(), { status: 200 });
  } catch (error) {
    return jsonErrorResponse(error);
  }
}

function assertOpsAuth(request: Request): void {
  const token = request.headers.get("x-admin-token") ?? "";
  const configuredRole = process.env.PHASE10_ADMIN_ROLE?.trim();
  const role = process.env.NODE_ENV === "test"
    ? request.headers.get("x-admin-role") ?? "support_agent"
    : configuredRole && allowedRolesForOps.has(configuredRole)
      ? configuredRole
      : "support_agent";
  if (!getConfiguredOpsToken() || token !== getConfiguredOpsToken() || !allowedRolesForOps.has(role)) {
    throw new ApiError("OPS_AUTH_REQUIRED", "ops access is not authorized.", { field: "x-admin-token", status: 401 });
  }
  if (process.env.PHASE10_OPS_MFA_ENABLED !== "true") return;
  const configuredMfaCode = process.env.PHASE10_OPS_MFA_CODE?.trim();
  if (!configuredMfaCode) {
    throw new ApiError("OPS_MFA_NOT_CONFIGURED", "ops second factor is not configured.", { field: "PHASE10_OPS_MFA_CODE", status: 503 });
  }
  if ((request.headers.get("x-admin-mfa-code") ?? "").trim() !== configuredMfaCode) {
    throw new ApiError("OPS_MFA_REQUIRED", "ops second factor is required.", { field: "x-admin-mfa-code", status: 403 });
  }
}

const allowedRolesForOps = new Set(["ops_admin", "support_agent", "content_reviewer"]);
