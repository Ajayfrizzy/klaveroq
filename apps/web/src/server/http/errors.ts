import { ZodError } from "zod";
import { getRequestId } from "../observability/request-context";
import { log, reportException } from "../observability/logger";

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}

export const apiError = async (error: unknown, request?: Request) => {
  const requestId = request ? getRequestId(request) : "unavailable";
  if (error instanceof ApiError)
    return Response.json(
      { error: { code: error.code, message: error.message, details: error.details, requestId } },
      { status: error.status, headers: { "x-request-id": requestId } },
    );
  if (error instanceof ZodError)
    return Response.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "The request is invalid.",
          details: error.flatten(),
          requestId,
        },
      },
      { status: 400, headers: { "x-request-id": requestId } },
    );
  await reportException(error, {
    requestId,
    method: request?.method,
    path: request ? new URL(request.url).pathname : undefined,
  });
  return Response.json(
    {
      error: {
        code: "INTERNAL_ERROR",
        message: "The request could not be completed.",
        requestId,
      },
    },
    { status: 500, headers: { "x-request-id": requestId } },
  );
};

export const withApi =
  <T extends unknown[]>(handler: (...args: T) => Promise<Response>) =>
  async (...args: T) => {
    const request = args[0] instanceof Request ? args[0] : undefined;
    const requestId = request ? getRequestId(request) : "unavailable";
    const startedAt = performance.now();
    try {
      const response = await handler(...args);
      response.headers.set("x-request-id", requestId);
      log.info("api.request_completed", {
        requestId,
        method: request?.method,
        path: request ? new URL(request.url).pathname : undefined,
        status: response.status,
        durationMs: Math.round(performance.now() - startedAt),
      });
      return response;
    } catch (error) {
      return apiError(error, request);
    }
  };
