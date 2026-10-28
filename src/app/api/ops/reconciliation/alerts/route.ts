import { ApiError, toErrorEnvelope } from "../../../../../errors.js";
import { sendOpsPaymentAlertWebhook } from "../../../../../phase10/launchOps.js";

export async function POST(request: Request): Promise<Response> {
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    const response = toErrorEnvelope(new ApiError("INVALID_JSON", "Request body must be valid JSON."));
    return Response.json(response.body, { status: response.status });
  }
  try {
    const response = await sendOpsPaymentAlertWebhook({
      ...body,
      auth: opsAuth(request)
    } as never);
    return Response.json(response, { status: 200 });
  } catch (error) {
    const response = toErrorEnvelope(error);
    return Response.json(response.body, { status: response.status });
  }
}

function opsAuth(request: Request) {
  return {
    token: request.headers.get("x-admin-token") ?? "",
    role: request.headers.get("x-admin-role") ?? "support_agent",
    actor_id: request.headers.get("x-admin-actor") ?? "ops_reconciliation_alert_route",
    mfa_code: request.headers.get("x-admin-mfa-code") ?? ""
  };
}
