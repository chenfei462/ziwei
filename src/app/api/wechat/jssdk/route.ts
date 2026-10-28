import { toErrorEnvelope } from "../../../../errors.js";
import { getShareLandingSnapshot } from "../../../../phase13/growth.js";
import { buildWechatJssdkConfig, resolveWechatJssdkReadiness } from "../../../../wechatShare.js";

export async function GET(request: Request): Promise<Response> {
  try {
    const searchParams = new URL(request.url).searchParams;
    const readiness = resolveWechatJssdkReadiness();
    if (!readiness.ready) {
      return Response.json(readiness, { status: 503 });
    }

    const shareId = searchParams.get("share_id") ?? undefined;
    const share = shareId ? getShareLandingSnapshot(shareId).snapshot : undefined;
    const response = buildWechatJssdkConfig({
      url: searchParams.get("url") ?? "",
      share
    });
    return Response.json(response, { status: 200 });
  } catch (error) {
    const response = toErrorEnvelope(error);
    return Response.json(response.body, { status: response.status });
  }
}
