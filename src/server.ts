import { createServer } from "node:http";
import { handleApiRequest } from "./api.js";

export function startServer(port = 8787) {
  const server = createServer(async (request, response) => {
    const chunks: Buffer[] = [];
    for await (const chunk of request) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }

    const rawBody = Buffer.concat(chunks).toString("utf8");
    const parsedBody = rawBody ? JSON.parse(rawBody) : undefined;
    const apiResponse = handleApiRequest(request.method ?? "GET", request.url ?? "/", parsedBody);

    response.statusCode = apiResponse.status;
    response.setHeader("content-type", "application/json; charset=utf-8");
    response.end(JSON.stringify(apiResponse.body));
  });

  server.listen(port);
  return server;
}
