import { beforeEach } from "vitest";

// Test-only credentials keep fixtures deterministic while production code still
// fails closed whenever these values are absent or weak.
beforeEach(() => {
  process.env.SESSION_SECRET ??= "test_session_secret_at_least_32_characters";
  process.env.PHASE10_ADMIN_TOKEN ??= "phase10_admin_token";
  process.env.MOCK_PAYMENT_WEBHOOK_SECRET ??= "test_mock_payment_webhook_secret";
  delete process.env.PAYMENT_WEBHOOK_PROVIDER;
});
