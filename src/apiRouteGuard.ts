import { assertWriteRequestAllowed } from "./apiSecurity.js";
import { ApiError, toErrorEnvelope } from "./errors.js";

export async function readProtectedJson(request: Request, options: { limit?: number; windowMs?: number } = {}): Promise<unknown> {
  await assertWriteRequestAllowed(request, options);
  try {
    return await request.json();
  } catch {
    throw new ApiError("INVALID_JSON", "Request body must be valid JSON.");
  }
}

export function jsonErrorResponse(error: unknown): Response {
  const response = toErrorEnvelope(error);
  return Response.json(response.body, { status: response.status });
}
