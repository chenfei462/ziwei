import { handleApiRequest } from "../../../../api.js";

export async function POST(request: Request): Promise<Response> {
  const rawBody = await request.text();
  const signature = request.headers.get("stripe-signature") ?? "";
  const response = handleApiRequest("POST", "/api/payment/webhook", {
    provider: "stripe_checkout",
    raw_body: rawBody,
    signature
  });
  return Response.json(response.body, { status: response.status });
}
