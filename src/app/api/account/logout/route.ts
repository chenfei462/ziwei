import { assertWriteRequestAllowed } from "../../../../apiSecurity.js";
import { buildLogoutCookieHeaders } from "../../../../auth.js";
import { jsonErrorResponse } from "../../../../apiRouteGuard.js";

export async function POST(request: Request): Promise<Response> {
  try {
    await assertWriteRequestAllowed(request, { limit: 20 });
    const secure = new URL(request.url).protocol === "https:";
    const headers = new Headers();
    for (const cookie of buildLogoutCookieHeaders({ secure })) {
      headers.append("set-cookie", cookie);
    }
    return Response.json(
      {
        ok: true,
        message: "已安全退出当前设备。",
        privacy: {
          clears_visitor_cookie: true,
          clears_member_cookie: true
        }
      },
      { status: 200, headers }
    );
  } catch (error) {
    return jsonErrorResponse(error);
  }
}
