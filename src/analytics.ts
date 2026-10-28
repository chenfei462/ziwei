import { productRepository } from "./repositories/productRepository.js";
import { productEventTypes, type ProductAnalyticsSummary, type ProductEventRecord, type ProductEventType } from "./types.js";
import type { RequestIdentity } from "./auth.js";

const privacy = {
  stores_full_birth_date: false,
  stores_birth_time: false,
  stores_location_detail: false,
  stores_video_frame: false
} as const;

export function recordProductEvent(
  type: ProductEventType,
  input: {
    identity?: RequestIdentity;
    chart_id?: string;
    share_id?: string;
    order_id?: string;
    report_id?: string;
    result?: string;
    metadata?: Record<string, string | number | boolean>;
  } = {}
): ProductEventRecord {
  const event: ProductEventRecord = {
    product_event_id: createId("product_event"),
    type,
    created_at: new Date().toISOString(),
    visitor_id: sanitizeText(input.identity?.visitorId),
    member_id: sanitizeText(input.identity?.memberId),
    chart_id: sanitizeText(input.chart_id),
    share_id: sanitizeText(input.share_id),
    order_id: sanitizeText(input.order_id),
    report_id: sanitizeText(input.report_id),
    result: sanitizeText(input.result),
    metadata: sanitizeMetadata(input.metadata ?? {}),
    privacy_note: "product analytics never store full birth date, birth time, location detail, or image payload."
  };
  productRepository.saveProductEvent(event);
  return event;
}

export function summarizeProductAnalytics(): ProductAnalyticsSummary {
  const events = productRepository.listProductEvents();
  const eventsByType = Object.fromEntries(productEventTypes.map((type) => [type, 0])) as Record<ProductEventType, number>;
  for (const event of events) {
    eventsByType[event.type] += 1;
  }
  return {
    total_events: events.length,
    events_by_type: eventsByType,
    events,
    privacy
  };
}

function sanitizeMetadata(metadata: Record<string, string | number | boolean>): Record<string, string | number | boolean> {
  const sanitized: Record<string, string | number | boolean> = {};
  for (const [key, value] of Object.entries(metadata)) {
    const safeKey = sanitizeText(key)?.slice(0, 40);
    if (!safeKey) continue;
    sanitized[safeKey] = typeof value === "string" ? sanitizeText(value)?.slice(0, 120) ?? "" : value;
  }
  return sanitized;
}

function sanitizeText(value: string | undefined): string | undefined {
  const sanitized = String(value ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\d{4}[-/]\d{1,2}[-/]\d{1,2}\b/g, "[birth_date_redacted]")
    .replace(/\b(?:[01]?\d|2[0-3]):[0-5]\d\b/g, "[birth_time_redacted]")
    .replace(/\b(?:Shanghai|Beijing|Guangzhou|Shenzhen|Chengdu|Hangzhou|Nanjing|Wuhan)\b|(?:北京|上海|广州|深圳|成都|杭州|南京|武汉)/gi, "[location_redacted]")
    .replace(/data:image\/[a-zA-Z+.-]+;base64,[A-Za-z0-9+/=]+/g, "[image_payload_redacted]");
  return sanitized || undefined;
}

function createId(prefix: string): string {
  return `${prefix}_${new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14)}_${Math.random().toString(36).slice(2, 8)}`;
}
