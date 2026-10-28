import { createHash } from "node:crypto";
import { assertCanReadChart, type RequestIdentity } from "../auth.js";
import { ApiError } from "../errors.js";
import { productRepository } from "../repositories/productRepository.js";
import { buildInterpretation } from "./interpretationEngine.js";
import { reviewInterpretationSafety } from "./ruleMatcher.js";
import {
  followUpTopics,
  type AiGenerationRecord,
  type ChartCreateResponse,
  type FollowUpRequest,
  type FollowUpQuotaUsage,
  type FollowUpResponse,
  type FollowUpTopic,
  type InterpretationTrace
} from "../types.js";

const freeQuota = 3;
const memberQuota = 20;
const followUpPromptVersion = "followup_trace_v2026_05_25";

const topicPalace: Record<FollowUpTopic, string> = {
  career: "career",
  relationship: "spouse",
  finance: "wealth",
  self_growth: "life",
  annual_rhythm: "migration"
};

const formalTopicLabels: Record<FollowUpTopic, string> = {
  career: "事业节奏",
  relationship: "关系模式",
  finance: "财务习惯",
  self_growth: "自我成长",
  annual_rhythm: "年度节奏"
};

const topicLabels: Record<FollowUpTopic, string> = {
  career: "事业节奏",
  relationship: "关系模式",
  finance: "财务习惯",
  self_growth: "自我成长",
  annual_rhythm: "年度节奏"
};

export function answerFollowUp(request: FollowUpRequest, identity: RequestIdentity): FollowUpResponse {
  validateRequest(request);
  assertQuestionAllowed(request.question);
  const subjectId = identity.memberId ?? identity.visitorId;
  const plan = identity.memberId ? "member" : "free";
  const limit = plan === "member" ? memberQuota : freeQuota;
  const windowStart = new Date().toISOString().slice(0, 10);
  const quotaKey = `${subjectId}:${windowStart}`;
  assertCanReadChart(productRepository.getChartOwner(request.chart_id), identity);
  const usedBefore = productRepository.getFollowUpQuotaUsage(quotaKey);
  if (usedBefore >= limit) {
    throw new ApiError("FOLLOW_UP_QUOTA_EXCEEDED", "今日追问次数已用完。会员可获得更高额度。", { field: "quota", status: 429 });
  }

  const stored = productRepository.getChart(request.chart_id);
  if (!stored) {
    throw new ApiError("CHART_NOT_FOUND", "chart not found.", { field: "chart_id", status: 404 });
  }
  const palaceId = topicPalace[request.topic];
  const palace = stored.chart.palaces.find((item) => item.palace_id === palaceId) ?? stored.chart.palaces[0];
  const interpretation = buildInterpretation({
    chart_id: request.chart_id,
    chart: stored.chart,
    palace,
    mode: "entertainment",
    include_trace: true
  });
  const trace = interpretation.trace.slice(0, 3);
  const baseAnswer = [
    `依据${palace.name}与已命中的 ${trace.length} 条本地规则，${formalTopicLabels[request.topic]}更适合被理解为一种观察线索。`,
    interpretation.interpretation.scenario,
    interpretation.interpretation.advice,
    "回答只引用当前命盘规则 trace，不新增命理结论。仅供结构参考，不作为医疗、法律、投资或婚姻重大决策依据。"
  ].join(" ");
  const reviewed = reviewInterpretationSafety(baseAnswer, ["ai_followup_trace_grounded", ...interpretation.interpretation.safety_flags]);
  const used = productRepository.incrementFollowUpQuota({
    quota_key: quotaKey,
    subject_id: subjectId,
    plan,
    window_start: windowStart,
    limit
  });
  const generation = recordFollowUpGeneration(request, reviewed.text, trace, reviewed.flags);
  productRepository.saveAiGenerationRecord(generation);

  return {
    follow_up_id: createId("followup"),
    chart_id: request.chart_id,
    topic: request.topic,
    question_summary: sanitizeQuestion(request.question),
    answer: reviewed.text,
    trace,
    quota: {
      subject_id: subjectId,
      plan,
      used,
      limit,
      remaining: Math.max(0, limit - used)
    },
    safety_flags: reviewed.flags,
    generation
  };
}

export async function answerFollowUpAsync(request: FollowUpRequest, identity: RequestIdentity): Promise<FollowUpResponse> {
  validateRequest(request);
  assertQuestionAllowed(request.question);
  const subjectId = identity.memberId ?? identity.visitorId;
  const plan = identity.memberId ? "member" : "free";
  const limit = plan === "member" ? memberQuota : freeQuota;
  const windowStart = new Date().toISOString().slice(0, 10);
  const quotaKey = `${subjectId}:${windowStart}`;
  assertCanReadChart(await productRepository.getChartOwnerAsync(request.chart_id), identity);
  const usedBefore = await productRepository.getFollowUpQuotaUsageAsync(quotaKey);
  if (usedBefore >= limit) {
    throw new ApiError("FOLLOW_UP_QUOTA_EXCEEDED", "今日追问次数已用完。会员可获得更高额度。", { field: "quota", status: 429 });
  }

  const stored = await productRepository.getChartAsync(request.chart_id);
  if (!stored) {
    throw new ApiError("CHART_NOT_FOUND", "chart not found.", { field: "chart_id", status: 404 });
  }
  const used = await productRepository.incrementFollowUpQuotaAsync({
    quota_key: quotaKey,
    subject_id: subjectId,
    plan,
    window_start: windowStart,
    limit
  });
  if (used > limit) {
    throw new ApiError("FOLLOW_UP_QUOTA_EXCEEDED", "今日追问次数已用完。会员可获得更高额度。", { field: "quota", status: 429 });
  }
  const palaceId = topicPalace[request.topic];
  const palace = stored.chart.palaces.find((item) => item.palace_id === palaceId) ?? stored.chart.palaces[0];
  const interpretation = buildInterpretation({
    chart_id: request.chart_id,
    chart: stored.chart,
    palace,
    mode: "entertainment",
    include_trace: true
  });
  const trace = interpretation.trace.slice(0, 3);
  const baseAnswer = [
    `依据${palace.name}与已命中的 ${trace.length} 条本地规则，${topicLabels[request.topic]}更适合被理解为一种观察线索。`,
    interpretation.interpretation.scenario,
    interpretation.interpretation.advice,
    "回答只引用当前命盘规则 trace，不新增命理结论。仅供结构参考，不作为医疗、法律、投资或婚姻重大决策依据。"
  ].join(" ");
  const reviewed = reviewInterpretationSafety(baseAnswer, ["ai_followup_trace_grounded", ...interpretation.interpretation.safety_flags]);
  const generation = recordFollowUpGeneration(request, reviewed.text, trace, reviewed.flags);
  await productRepository.saveAiGenerationRecordAsync(generation);

  return {
    follow_up_id: createId("followup"),
    chart_id: request.chart_id,
    topic: request.topic,
    question_summary: sanitizeQuestion(request.question),
    answer: reviewed.text,
    trace,
    quota: {
      subject_id: subjectId,
      plan,
      used,
      limit,
      remaining: Math.max(0, limit - used)
    },
    safety_flags: reviewed.flags,
    generation
  };
}

function validateRequest(request: FollowUpRequest): void {
  if (!request?.chart_id) {
    throw new ApiError("CHART_NOT_FOUND", "chart_id is required.", { field: "chart_id", status: 404 });
  }
  if (!followUpTopics.includes(request.topic)) {
    throw new ApiError("INVALID_FOLLOW_UP_TOPIC", "topic must be career, relationship, finance, self_growth, or annual_rhythm.", { field: "topic" });
  }
  if (!request.question?.trim()) {
    throw new ApiError("FOLLOW_UP_QUESTION_REQUIRED", "question is required.", { field: "question" });
  }
}

function assertQuestionAllowed(question: string): void {
  const formalBlocked = ["股票", "投资品", "发财", "诊断", "疾病", "离婚", "官司", "必须", "一定"];
  if (formalBlocked.some((term) => question.includes(term))) {
    throw new ApiError("CONTENT_REVIEW_BLOCKED", "追问涉及医疗、投资、法律、婚恋定论或绝对化判断，已按安全规则拦截。", {
      field: "question",
      status: 409
    });
  }
  const blocked = ["股票", "投资哪", "发财", "诊断", "疾病", "离婚", "官司", "必须", "一定"];
  if (blocked.some((term) => question.includes(term))) {
    throw new ApiError("CONTENT_REVIEW_BLOCKED", "追问涉及医疗、投资、法律、婚恋定论或绝对化判断，已按安全规则拦截。", {
      field: "question",
      status: 409
    });
  }
}

function recordFollowUpGeneration(
  request: FollowUpRequest,
  answer: string,
  trace: InterpretationTrace[],
  safetyFlags: string[]
): AiGenerationRecord {
  const record: AiGenerationRecord = {
    generation_id: createId("ai_followup"),
    provider: "local_followup",
    model: "local_trace_v1",
    prompt_version: followUpPromptVersion,
    chart_id: request.chart_id,
    report_id: request.report_id,
    input_digest: digestJson({
      chart_id: request.chart_id,
      report_id: request.report_id,
      topic: request.topic,
      question_summary: sanitizeQuestion(request.question),
      trace_ids: trace.map((item) => item.rule_id)
    }),
    output_digest: digestJson(answer),
    status: "generated",
    safety_flags: [...new Set(["ai_followup_trace_grounded", ...safetyFlags])],
    created_at: new Date().toISOString(),
    privacy_note: "Follow-up records persist digests, trace ids, and safety flags; raw question and birth data are not persisted."
  };
  return record;
}

function sanitizeQuestion(question: string): string {
  return question.replace(/\s+/g, " ").trim().slice(0, 80);
}

function digestJson(value: unknown): string {
  return `sha256:${createHash("sha256").update(JSON.stringify(value)).digest("hex")}`;
}

function createId(prefix: string): string {
  return `${prefix}_${new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14)}_${Math.random().toString(36).slice(2, 8)}`;
}
