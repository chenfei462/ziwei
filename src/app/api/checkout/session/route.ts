import { handleApiRequest } from "../../../../api.js";
import { readProtectedJson } from "../../../../apiRouteGuard.js";
import { getCommerceSubjectId, getRequestIdentity } from "../../../../auth.js";
import { ApiError, toErrorEnvelope } from "../../../../errors.js";
import type { Order } from "../../../../types.js";

export async function POST(request: Request): Promise<Response> {
  try {
    const body = (await readProtectedJson(request)) as {
      order_id?: string;
      provider?: string;
      success_url?: string;
      cancel_url?: string;
    };
    const identity = getRequestIdentity(request);
    const orderResponse = handleApiRequest("GET", `/api/order/${body.order_id ?? ""}`);
    if (orderResponse.status !== 200) {
      return Response.json(orderResponse.body, { status: orderResponse.status });
    }
    const order = orderResponse.body as unknown as Order;
    if (order.member_id !== getCommerceSubjectId(identity)) {
      throw new ApiError("ORDER_ACCESS_FORBIDDEN", "你无权访问该订单。", { field: "order_id", status: 403 });
    }
    const response = handleApiRequest("POST", "/api/checkout/session", body);
    return Response.json(response.body, { status: response.status });
  } catch (error) {
    const response = toErrorEnvelope(error);
    return Response.json(response.body, { status: response.status });
  }
}
