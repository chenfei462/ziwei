export class ApiError extends Error {
  readonly code: string;
  readonly field?: string;
  readonly status: number;

  constructor(code: string, message: string, options: { field?: string; status?: number } = {}) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.field = options.field;
    this.status = options.status ?? 400;
  }
}

export function toErrorEnvelope(error: unknown) {
  if (error instanceof ApiError) {
    return {
      status: error.status,
      body: {
        error: {
          code: error.code,
          message: error.message,
          field: error.field,
          request_id: createRequestId()
        }
      }
    };
  }

  return {
    status: 500,
    body: {
      error: {
        code: "INTERNAL_ERROR",
        message: "排盘服务暂时不可用。",
        request_id: createRequestId()
      }
    }
  };
}

export function createRequestId(): string {
  return `req_${new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14)}_${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}
