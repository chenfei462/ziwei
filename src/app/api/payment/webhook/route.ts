import { handleApiRequest } from "../../../../api.js";
import { ApiError, toErrorEnvelope } from "../../../../errors.js";
import { paymentProviders, type PaymentProvider } from "../../../../types.js";

const providerSignatureHeaders: Record<PaymentProvider, string> = {
  stripe_checkout: "stripe-signature",
  mock_checkout: "mock-signature",
  wechat_pay_reserved: "wechatpay-signature",
  alipay_reserved: "alipay-signature"
};

export async function POST(request: Request): Promise<Response> {
  try {
    const rawBody = await request.text();
    const provider = resolveWebhookProvider(request);
    const signatureHeader = providerSignatureHeaders[provider];
    const signature = resolveProviderSignature(request, provider, signatureHeader);
    const response = handleApiRequest("POST", "/api/payment/webhook", {
      provider,
      raw_body: rawBody,
      signature
    });
    return Response.json(response.body, { status: response.status });
  } catch (error) {
    const response = toErrorEnvelope(error);
    return Response.json(response.body, { status: response.status });
  }
}

function resolveProviderSignature(request: Request, provider: PaymentProvider, fallbackHeader: string): string {
  if (provider === "wechat_pay_reserved") {
    const timestamp = request.headers.get("wechatpay-timestamp");
    const nonce = request.headers.get("wechatpay-nonce");
    const serial = request.headers.get("wechatpay-serial");
    const signature = request.headers.get("wechatpay-signature");
    if (timestamp && nonce && signature) {
      return `wechatpay-timestamp=${timestamp},wechatpay-nonce=${nonce},wechatpay-serial=${serial ?? ""},wechatpay-signature=${signature}`;
    }
  }
  if (provider === "alipay_reserved") {
    const alipaySignature = request.headers.get("alipay-signature");
    if (alipaySignature) return alipaySignature;
    return "alipay-rsa2";
  }
  return request.headers.get(fallbackHeader) ?? "";
}

function resolveWebhookProvider(request: Request): PaymentProvider {
  const url = new URL(request.url);
  const requested = url.searchParams.get("provider") || request.headers.get("x-payment-provider");
  const configured = process.env.PAYMENT_WEBHOOK_PROVIDER?.trim();
  if (!configured) {
    if (process.env.VITEST || process.env.NODE_ENV === undefined || process.env.NODE_ENV === "test") {
      if (!requested) return "stripe_checkout";
      if (paymentProviders.includes(requested as PaymentProvider)) return requested as PaymentProvider;
    }
    throw new ApiError("PAYMENT_WEBHOOK_PROVIDER_NOT_CONFIGURED", "PAYMENT_WEBHOOK_PROVIDER must be configured before accepting callbacks.", {
      field: "PAYMENT_WEBHOOK_PROVIDER",
      status: 503
    });
  }
  if (!paymentProviders.includes(configured as PaymentProvider)) {
    throw new ApiError("INVALID_PAYMENT_PROVIDER", "configured PAYMENT_WEBHOOK_PROVIDER is invalid.", { field: "PAYMENT_WEBHOOK_PROVIDER", status: 503 });
  }
  if (requested && requested !== configured) {
    throw new ApiError("PAYMENT_PROVIDER_MISMATCH", "webhook provider is fixed by server configuration.", { field: "provider", status: 409 });
  }
  return configured as PaymentProvider;
}
