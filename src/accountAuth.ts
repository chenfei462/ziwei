import { createHash, createHmac, randomInt } from "node:crypto";
import { ApiError } from "./errors.js";
import { persistAnonymousMemberLink } from "./accountLinking.js";
import { linkAnonymousMember } from "./phase14/channels.js";
import { productRepository } from "./repositories/productRepository.js";
import type {
  DailyPrivacy,
  SmsVerificationChallenge,
  SmsVerificationLoginRequest,
  SmsVerificationLoginResponse,
  SmsVerificationSendRequest,
  SmsVerificationSendResponse
} from "./types.js";

const smsChallengeTtlMs = 5 * 60 * 1000;
const smsSendCooldownMs = 60 * 1000;
const smsMaxAttempts = 5;
const sessionMaxAgeSeconds = 60 * 60 * 24 * 180;

const privacy: DailyPrivacy = {
  hides_full_birth_date: true,
  hides_birth_time: true,
  hides_location_detail: true,
  stores_video_frame: false,
  stores_full_birth_profile: false
};

const challengePrivacyNote = "raw phone number and verification code are never stored; only sha256 hashes are persisted.";

type SmsDeliveryResult = {
  status: "mock_sent" | "sent";
  messageId?: string;
};

export async function requestSmsVerification(request: SmsVerificationSendRequest): Promise<SmsVerificationSendResponse> {
  const phone = normalizeChineseMobile(request?.phone);
  const phoneHash = hashIdentifier(phone);
  const existingChallenge = await productRepository.findActiveSmsVerificationChallengeByPhoneHashAsync(phoneHash, new Date().toISOString());
  if (existingChallenge) {
    const createdAt = Date.parse(existingChallenge.created_at);
    if (Number.isFinite(createdAt) && Date.now() - createdAt < smsSendCooldownMs) {
      throw new ApiError("SMS_SEND_COOLDOWN", "验证码发送过于频繁，请稍后再试。", {
        field: "phone",
        status: 429
      });
    }
  }
  const provider = getRequiredEnv("SMS_PROVIDER", "SMS_PROVIDER_REQUIRED", "SMS_PROVIDER is required.", "provider");
  const accessKey = getRequiredEnv("SMS_ACCESS_KEY", "SMS_ACCESS_KEY_REQUIRED", "SMS_ACCESS_KEY is required.", "provider");
  const templateId = getRequiredEnv("SMS_TEMPLATE_ID", "SMS_TEMPLATE_ID_REQUIRED", "SMS_TEMPLATE_ID is required.", "provider");
  const code = provider === "mock_sms" ? getMockSmsCode() : createSmsCode();
  const delivery = await deliverSmsCode({ provider, phone, code, templateId, accessKey });
  const now = new Date();
  const challenge: SmsVerificationChallenge = {
    challenge_id: createId("sms_challenge"),
    phone_hash: phoneHash,
    code_hash: hashSmsCode(phone, code, accessKey),
    provider,
    template_id: templateId,
    purpose: "login",
    attempt_count: 0,
    max_attempts: smsMaxAttempts,
    created_at: now.toISOString(),
    expires_at: new Date(now.getTime() + smsChallengeTtlMs).toISOString(),
    delivery_status: delivery.status,
    provider_message_id: delivery.messageId,
    privacy_note: challengePrivacyNote
  };
  await productRepository.saveSmsVerificationChallengeAsync(challenge);

  return {
    challenge_id: challenge.challenge_id,
    masked_phone: maskChineseMobile(phone),
    expires_at: challenge.expires_at,
    delivery: {
      provider,
      template_id: templateId,
      status: challenge.delivery_status,
      external_delivery_required: provider !== "mock_sms",
      message_id: delivery.messageId
    },
    privacy
  };
}

export async function loginWithSmsVerification(request: SmsVerificationLoginRequest): Promise<SmsVerificationLoginResponse> {
  const phone = normalizeChineseMobile(request?.phone);
  const code = normalizeSmsCode(request?.code);
  const accessKey = getRequiredEnv("SMS_ACCESS_KEY", "SMS_ACCESS_KEY_REQUIRED", "SMS_ACCESS_KEY is required.", "provider");
  const sessionSecret = process.env.SESSION_SECRET?.trim() ?? "";
  if (sessionSecret.length < 24) {
    throw new ApiError("SESSION_SECRET_REQUIRED", "SESSION_SECRET is required before SMS login can issue a member session.", { field: "session", status: 503 });
  }
  const phoneHash = hashIdentifier(phone);
  const nowIso = new Date().toISOString();
  const challenge = await productRepository.findActiveSmsVerificationChallengeByPhoneHashAsync(phoneHash, nowIso);
  if (!challenge) {
    throw new ApiError("SMS_CODE_EXPIRED", "验证码已过期，请重新获取。", { field: "code", status: 401 });
  }
  if (challenge.attempt_count >= challenge.max_attempts) {
    throw new ApiError("SMS_CODE_LOCKED", "验证码尝试次数过多，请重新获取。", { field: "code", status: 429 });
  }
  const codeHash = hashSmsCode(phone, code, accessKey);
  if (codeHash !== challenge.code_hash) {
    await productRepository.saveSmsVerificationChallengeAsync({
      ...challenge,
      attempt_count: challenge.attempt_count + 1
    });
    throw new ApiError("SMS_CODE_INVALID", "验证码不正确。", { field: "code", status: 401 });
  }

  const memberId = normalizeMemberId(request.member_id) ?? memberIdFromPhoneHash(phoneHash);
  const visitorId = normalizeVisitorId(request.visitor_id);
  const existingUser = await productRepository.getUserAsync(memberId);
  const linked = linkAnonymousMember({
    visitor_id: visitorId,
    member_id: memberId,
    phone,
    display_name: sanitizeDisplayName(request.display_name ?? existingUser?.display_name ?? "手机用户")
  });
  await persistAnonymousMemberLink(linked);
  await productRepository.saveSmsVerificationChallengeAsync({
    ...challenge,
    attempt_count: challenge.attempt_count + 1,
    consumed_at: new Date().toISOString()
  });

  return {
    ...linked,
    challenge_id: challenge.challenge_id,
    session: {
      member_id: linked.user.member_id,
      visitor_id: visitorId,
      http_only_cookie: true,
      max_age_seconds: sessionMaxAgeSeconds
    }
  };
}

export function normalizeChineseMobile(input: unknown): string {
  const phone = String(input ?? "").replace(/\D/g, "");
  if (!/^1[3-9]\d{9}$/.test(phone)) {
    throw new ApiError("INVALID_PHONE", "请输入有效的中国大陆手机号。", { field: "phone" });
  }
  return phone;
}

export function maskChineseMobile(phone: string): string {
  return `${phone.slice(0, 3)}****${phone.slice(-4)}`;
}

function normalizeSmsCode(input: unknown): string {
  const code = String(input ?? "").trim();
  if (!/^\d{6}$/.test(code)) {
    throw new ApiError("INVALID_SMS_CODE", "验证码格式不正确。", { field: "code" });
  }
  return code;
}

function getRequiredEnv(name: string, code: string, message: string, field: string): string {
  const value = process.env[name]?.trim() ?? "";
  if (!value) throw new ApiError(code, message, { field, status: 503 });
  return value;
}

function getMockSmsCode(): string {
  const code = process.env.SMS_TEST_FIXED_CODE?.trim() ?? "";
  if (!/^\d{6}$/.test(code)) {
    throw new ApiError("SMS_TEST_CODE_REQUIRED", "SMS_TEST_FIXED_CODE must be a 6 digit code for mock_sms.", { field: "provider", status: 503 });
  }
  return code;
}

function createSmsCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

async function deliverSmsCode(input: { provider: string; phone: string; code: string; templateId: string; accessKey: string }): Promise<SmsDeliveryResult> {
  if (input.provider === "mock_sms") return { status: "mock_sent" };
  if (input.provider !== "http_sms") {
    throw new ApiError("SMS_PROVIDER_UNSUPPORTED", "SMS_PROVIDER must be mock_sms or http_sms.", { field: "provider", status: 503 });
  }

  const endpoint = getRequiredEnv("SMS_HTTP_ENDPOINT", "SMS_HTTP_ENDPOINT_REQUIRED", "SMS_HTTP_ENDPOINT is required for http_sms.", "provider");
  const signingSecret = getRequiredEnv(
    "SMS_HTTP_SIGNING_SECRET",
    "SMS_HTTP_SIGNING_SECRET_REQUIRED",
    "SMS_HTTP_SIGNING_SECRET is required for http_sms.",
    "provider"
  );
  const payload = {
    phone: input.phone,
    code: input.code,
    template_id: input.templateId,
    purpose: "login",
    nonce: createId("sms_nonce"),
    issued_at: new Date().toISOString()
  };
  const rawBody = JSON.stringify(payload);
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-ziwei-sms-provider": input.provider,
      "x-ziwei-sms-access-key": input.accessKey,
      "x-ziwei-sms-signature": `sha256=${createHmac("sha256", signingSecret).update(rawBody).digest("hex")}`
    },
    body: rawBody
  });

  if (!response.ok) {
    throw new ApiError("SMS_DELIVERY_FAILED", "SMS provider delivery failed.", { field: "provider", status: response.status >= 500 ? 502 : 503 });
  }

  const body = (await response.json().catch(() => ({}))) as { message_id?: unknown };
  return {
    status: "sent",
    messageId: typeof body.message_id === "string" ? body.message_id.slice(0, 120) : undefined
  };
}

function hashSmsCode(phone: string, code: string, accessKey: string): string {
  return `sha256:${createHash("sha256").update(`${phone}:${code}:${accessKey}`).digest("hex")}`;
}

function hashIdentifier(value: string): string {
  return `sha256:${createHash("sha256").update(String(value).trim().toLowerCase()).digest("hex")}`;
}

function normalizeVisitorId(visitorId: string | undefined): string {
  const value = String(visitorId ?? "")
    .replace(/[^a-zA-Z0-9_:-]/g, "")
    .slice(0, 80);
  return value || createId("visitor");
}

function normalizeMemberId(memberId: string | undefined): string | undefined {
  const value = String(memberId ?? "")
    .replace(/[^a-zA-Z0-9_:-]/g, "")
    .slice(0, 80);
  return value || undefined;
}

function memberIdFromPhoneHash(phoneHash: string): string {
  return `member_phone_${phoneHash.replace(/^sha256:/, "").slice(0, 24)}`;
}

function sanitizeDisplayName(name: string): string {
  return String(name ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\d{4}[-/]\d{1,2}[-/]\d{1,2}/g, "[birth_date_redacted]")
    .replace(/\b(?:[01]?\d|2[0-3]):[0-5]\d\b/g, "[birth_time_redacted]")
    .slice(0, 80);
}

function createId(prefix: string): string {
  return `${prefix}_${new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14)}_${Math.random().toString(36).slice(2, 8)}`;
}
