import { recordProductEvent } from "../../../../../analytics.js";
import { readProtectedJson } from "../../../../../apiRouteGuard.js";
import { getCommerceSubjectId, getRequestIdentity } from "../../../../../auth.js";
import { ApiError, toErrorEnvelope } from "../../../../../errors.js";
import { confirmSandboxCheckout } from "../../../../../phase9/commerce.js";
import { productRepository } from "../../../../../repositories/productRepository.js";

export async function POST(request: Request): Promise<Response> {
  try {
    const body = (await readProtectedJson(request, { limit: 12, windowMs: 60_000 })) as { session_id?: unknown };
    const sessionId = typeof body.session_id === "string" ? body.session_id : "";
    if (!sessionId) {
      throw new ApiError("CHECKOUT_SESSION_REQUIRED", "session_id is required.", { field: "session_id" });
    }

    const identity = getRequestIdentity(request);
    const session = productRepository.getCheckoutSession(sessionId);
    if (!session) {
      throw new ApiError("CHECKOUT_SESSION_NOT_FOUND", "checkout session not found.", { field: "session_id", status: 404 });
    }
    const order = productRepository.getOrder(session.order_id);
    if (!order) {
      throw new ApiError("ORDER_NOT_FOUND", "order not found.", { field: "order_id", status: 404 });
    }
    if (order.member_id !== getCommerceSubjectId(identity)) {
      throw new ApiError("ORDER_ACCESS_FORBIDDEN", "你无权访问该订单。", { field: "session_id", status: 403 });
    }

    const event = confirmSandboxCheckout(session.checkout_session_id);
    if (!event.is_duplicate) {
      recordProductEvent("payment_result", {
        identity,
        order_id: event.order_id,
        report_id: event.order.report_id,
        result: event.order.status,
        metadata: { event_type: event.event_type, duplicate: event.is_duplicate, provider: event.provider }
      });
    }
    return Response.json(event, { status: 200 });
  } catch (error) {
    const response = toErrorEnvelope(error);
    return Response.json(response.body, { status: response.status });
  }
}
