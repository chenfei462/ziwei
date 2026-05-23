import { handleApiRequest } from "../../../api.js";
import { ApiError, toErrorEnvelope } from "../../../errors.js";
import { generateDeepSeekInterpretation } from "../../../phase3/deepseekClient.js";
import type { InterpretResponse } from "../../../types.js";

export async function POST(request: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    const response = toErrorEnvelope(new ApiError("INVALID_JSON", "Request body must be valid JSON."));
    return Response.json(response.body, { status: response.status });
  }

  const response = handleApiRequest("POST", "/api/interpret", body);
  if (response.status !== 200) {
    return Response.json(response.body, { status: response.status });
  }

  const interpretation = response.body as unknown as InterpretResponse;
  if (interpretation.status !== "ready") {
    return Response.json(response.body, { status: response.status });
  }

  const generated = await generateDeepSeekInterpretation(interpretation);
  return Response.json(generated, { status: response.status });
}
