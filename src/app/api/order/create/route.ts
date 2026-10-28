import { handleApiRequest } from "../../../../api.js";
import { readProtectedJson } from "../../../../apiRouteGuard.js";
import { recordProductEvent } from "../../../../analytics.js";
import { getCommerceSubjectId, getRequestIdentity } from "../../../../auth.js";
import { toErrorEnvelope } from "../../../../errors.js";
import type { Order } from "../../../../types.js";

export async function POST(request: Request): Promise<Response> {
  try {
    const body = (await readProtectedJson(request)) as Record<string, unknown>;
    const identity = getRequestIdentity(request);
    const response = handleApiRequest("POST", "/api/order/create", {
      ...body,
      member_id: getCommerceSubjectId(identity)
    });
    if (response.status === 201) {
      const order = response.body as unknown as Order;
      recordProductEvent("order_created", {
        identity,
        order_id: order.order_id,
        report_id: order.report_id,
        metadata: { tier_id: order.tier_id, amount_cents: order.amount_cents }
      });
    }
    return Response.json(response.body, { status: response.status });
  } catch (error) {
    const response = toErrorEnvelope(error);
    return Response.json(response.body, { status: response.status });
  }
}
