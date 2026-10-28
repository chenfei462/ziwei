import { handleApiRequest } from "../../../../api.js";
import { getCommerceSubjectId, getRequestIdentity } from "../../../../auth.js";
import { ApiError, toErrorEnvelope } from "../../../../errors.js";
import type { Order } from "../../../../types.js";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(request: Request, context: RouteContext): Promise<Response> {
  try {
    const { id } = await context.params;
    const identity = getRequestIdentity(request);
    const response = handleApiRequest("GET", `/api/order/${id}`);
    if (response.status !== 200) {
      return Response.json(response.body, { status: response.status });
    }
    const order = response.body as unknown as Order;
    if (order.member_id !== getCommerceSubjectId(identity)) {
      throw new ApiError("ORDER_ACCESS_FORBIDDEN", "你无权访问该订单。", { field: "order_id", status: 403 });
    }
    return Response.json(response.body, { status: response.status });
  } catch (error) {
    const response = toErrorEnvelope(error);
    return Response.json(response.body, { status: response.status });
  }
}
