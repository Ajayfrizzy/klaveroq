import { ApiError } from "../http/errors";
import {
  isTransientDatabaseError,
  reportRenderFailure,
  ReportedRenderError,
  safeCorrelationId,
  type RenderOperation,
} from "./render-errors";
import { log } from "./logger";

export async function requiredOperation<T>(
  requestId: string,
  operation: RenderOperation,
  run: () => PromiseLike<T>,
): Promise<T> {
  const start = performance.now();
  try {
    const result = await run();
    const durationMs = Math.round(performance.now() - start);
    if (durationMs >= 1_000)
      log.warn("server.operation_slow", {
        requestId: safeCorrelationId(requestId),
        operation,
        durationMs,
      });
    return result;
  } catch (error) {
    const failure = await reportRenderFailure(error, {
      requestId,
      operation,
      durationMs: Math.round(performance.now() - start),
    });
    if (error instanceof ApiError) throw error;
    throw new ReportedRenderError(failure.fingerprint, failure.code);
  }
}
export async function optionalOperation<T>(
  requestId: string,
  operation: RenderOperation,
  run: () => PromiseLike<T>,
): Promise<T | null> {
  const start = performance.now();
  try {
    return await run();
  } catch (error) {
    const failure = await reportRenderFailure(error, {
      requestId,
      operation,
      optional: true,
      durationMs: Math.round(performance.now() - start),
    });
    // Schema/permission/programming errors are not transient and must reach the boundary.
    if (!isTransientDatabaseError(error)) {
      if (error instanceof ApiError) throw error;
      throw new ReportedRenderError(failure.fingerprint, failure.code);
    }
    return null;
  }
}
