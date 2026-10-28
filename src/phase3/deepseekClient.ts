import { createHash } from "node:crypto";
import { reviewInterpretationSafety } from "./ruleMatcher.js";
import { productRepository } from "../repositories/productRepository.js";
import type { InterpretResponse } from "../types.js";

export const deepSeekProvider = "deepseek" as const;
export const deepSeekModel = "deepseek-v4-flash" as const;
export const promptVersion = "interpretation_rewrite_v2026_05_25" as const;
const deepSeekUrl = "https://api.deepseek.com/chat/completions";
const requestTimeoutMs = 15_000;

type GeneratedCopy = {
  interpretation: string;
  scenario: string;
  advice: string;
};

type GenerationFallbackReason = NonNullable<InterpretResponse["generation"]>["reason"];

type DeepSeekGeneration =
  | {
      status: "generated";
      copy: GeneratedCopy;
      safety_flags: string[];
    }
  | {
      status: "fallback";
      reason: GenerationFallbackReason;
    };

type DeepSeekChatResponse = {
  choices?: Array<{
    message?: {
      content?: unknown;
    };
  }>;
};

export async function generateDeepSeekInterpretation(base: InterpretResponse): Promise<InterpretResponse> {
  const generation = await requestDeepSeekCopy(base);
  if (generation.status === "fallback") {
    recordGenerationAttempt(base, "fallback", generation.reason, undefined, base.interpretation.safety_flags);
    return {
      ...base,
      generation: {
        provider: deepSeekProvider,
        model: deepSeekModel,
        status: "fallback",
        prompt_version: promptVersion,
        reason: generation.reason
      }
    };
  }

  recordGenerationAttempt(base, "generated", undefined, generation.copy, generation.safety_flags);
  return {
    ...base,
    interpretation: {
      ...base.interpretation,
      interpretation: generation.copy.interpretation,
      scenario: generation.copy.scenario,
      advice: generation.copy.advice,
      safety_flags: unique([...base.interpretation.safety_flags, ...generation.safety_flags])
    },
    generation: {
      provider: deepSeekProvider,
      model: deepSeekModel,
      status: "generated",
      prompt_version: promptVersion
    }
  };
}

async function requestDeepSeekCopy(base: InterpretResponse): Promise<DeepSeekGeneration> {
  const apiKey = process.env.DEEPSEEK_API_KEY?.trim();
  if (isTestRuntime() && !isMockedFetch()) {
    return { status: "fallback", reason: "test_mode" };
  }

  if (!apiKey) {
    return { status: "fallback", reason: "missing_api_key" };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), requestTimeoutMs);

  try {
    const response = await fetch(deepSeekUrl, {
      method: "POST",
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json"
      },
      body: JSON.stringify({
        model: deepSeekModel,
        stream: false,
        messages: [
          {
            role: "system",
            content:
              "你是中文紫微斗数解读助手。只能基于提供的本地规则结果和 trace 改写文案；不要生成绝对预测、恐吓表达，或医疗、法律、投资、婚姻等重大决策建议。只返回严格 JSON，字段为 interpretation、scenario、advice。"
          },
          {
            role: "user",
            content: JSON.stringify(buildPromptPayload(base))
          }
        ]
      }),
      signal: controller.signal
    });

    if (!response.ok) {
      return { status: "fallback", reason: "api_error" };
    }

    const payload = (await response.json()) as DeepSeekChatResponse;
    const content = payload.choices?.[0]?.message?.content;
    if (typeof content !== "string" || !content.trim()) {
      return { status: "fallback", reason: "empty_model_content" };
    }

    const generated = parseGeneratedCopy(content);
    if (!generated) {
      return { status: "fallback", reason: "invalid_model_json" };
    }

    const reviewedInterpretation = reviewInterpretationSafety(generated.interpretation, base.interpretation.safety_flags);
    const reviewedScenario = reviewInterpretationSafety(generated.scenario, reviewedInterpretation.flags);
    const reviewedAdvice = reviewInterpretationSafety(generated.advice, reviewedScenario.flags);

    return {
      status: "generated",
      copy: {
        interpretation: reviewedInterpretation.text,
        scenario: reviewedScenario.text,
        advice: reviewedAdvice.text
      },
      safety_flags: unique([...reviewedInterpretation.flags, ...reviewedScenario.flags, ...reviewedAdvice.flags])
    };
  } catch {
    return { status: "fallback", reason: "api_error" };
  } finally {
    clearTimeout(timeout);
  }
}

function recordGenerationAttempt(
  base: InterpretResponse,
  status: "generated" | "fallback",
  fallbackReason: GenerationFallbackReason | undefined,
  output: GeneratedCopy | undefined,
  safetyFlags: string[]
): void {
  const inputDigest = digestJson(buildPromptPayload(base));
  productRepository.saveAiGenerationRecord({
    generation_id: createId("ai_gen"),
    provider: deepSeekProvider,
    model: deepSeekModel,
    prompt_version: promptVersion,
    chart_id: base.chart_id,
    input_digest: inputDigest,
    output_digest: output ? digestJson(output) : undefined,
    status,
    fallback_reason: fallbackReason,
    safety_flags: unique(safetyFlags),
    created_at: new Date().toISOString(),
    privacy_note: "AI generation logs store digests, rule trace ids, status, and safety flags only; raw birth data and raw prompt text are not persisted."
  });
}

function digestJson(value: unknown): string {
  return `sha256:${createHash("sha256").update(JSON.stringify(value)).digest("hex")}`;
}

function createId(prefix: string): string {
  return `${prefix}_${new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14)}_${Math.random().toString(36).slice(2, 8)}`;
}

function buildPromptPayload(base: InterpretResponse) {
  return {
    palace_id: base.palace_id,
    mode: base.mode,
    basis: base.interpretation.basis,
    local_copy: {
      interpretation: base.interpretation.interpretation,
      scenario: base.interpretation.scenario,
      advice: base.interpretation.advice,
      confidence: base.interpretation.confidence,
      safety_flags: base.interpretation.safety_flags
    },
    trace: base.trace.map((item) => ({
      rule_id: item.rule_id,
      layer: item.layer,
      weight: item.weight,
      confidence: item.confidence,
      source: {
        title: item.source.title,
        modern_translation: item.source.modern_translation
      },
      safety_flags: item.safety_flags
    }))
  };
}

function parseGeneratedCopy(content: string): GeneratedCopy | undefined {
  try {
    const parsed = JSON.parse(stripJsonFence(content)) as Partial<GeneratedCopy>;
    if (!isNonEmptyString(parsed.interpretation) || !isNonEmptyString(parsed.scenario) || !isNonEmptyString(parsed.advice)) {
      return undefined;
    }
    return {
      interpretation: parsed.interpretation,
      scenario: parsed.scenario,
      advice: parsed.advice
    };
  } catch {
    return undefined;
  }
}

function stripJsonFence(content: string): string {
  return content.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function unique<T>(items: T[]): T[] {
  return [...new Set(items)];
}

function isTestRuntime(): boolean {
  return process.env.NODE_ENV === "test" || Boolean(process.env.VITEST);
}

function isMockedFetch(): boolean {
  const fetchFn = globalThis.fetch as typeof globalThis.fetch & { mock?: unknown };
  return typeof fetchFn.mock !== "undefined";
}
