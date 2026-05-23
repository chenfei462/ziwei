import { handleApiRequest } from "../../../../../../api.js";
import { ApiError, toErrorEnvelope } from "../../../../../../errors.js";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(request: Request, context: RouteContext): Promise<Response> {
  const { id } = await context.params;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    const response = toErrorEnvelope(new ApiError("INVALID_JSON", "Request body must be valid JSON."));
    return Response.json(response.body, { status: response.status });
  }

  const response = handleApiRequest("POST", `/api/immersive/session/${id}/event`, body);
  return Response.json(response.body, { status: response.status });
}
