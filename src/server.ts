import { createServer } from "node:http";
import type { RequestIdentity } from "./auth.js";
import { handleApiRequest } from "./api.js";

export function startServer(port = 8787) {
  const server = createServer(async (request, response) => {
    const chunks: Buffer[] = [];
    for await (const chunk of request) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }

    const rawBody = Buffer.concat(chunks).toString("utf8");
    const parsedBody = rawBody ? JSON.parse(rawBody) : undefined;
    const apiResponse = handleApiRequest(request.method ?? "GET", request.url ?? "/", parsedBody, {
      identity: requestIdentityFromHeaders(request.headers)
    });

    response.statusCode = apiResponse.status;
    response.setHeader("content-type", "application/json; charset=utf-8");
    response.end(JSON.stringify(apiResponse.body));
  });

  server.listen(port);
  return server;
}

function requestIdentityFromHeaders(headers: { [key: string]: string | string[] | undefined }): RequestIdentity | undefined {
  const visitorId = firstHeader(headers["x-visitor-id"]);
  const memberId = firstHeader(headers["x-member-id"]);
  if (!visitorId && !memberId) return undefined;
  return {
    visitorId: visitorId ?? "visitor_guest",
    memberId
  };
}

function firstHeader(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}
