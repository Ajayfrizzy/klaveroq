import type { Instrumentation } from "next";

export const onRequestError: Instrumentation.onRequestError = async (error, request, context) => {
  if (process.env.NEXT_RUNTIME !== "nodejs" || context.routeType !== "render") return;
  const { reportRenderFailure, safeCorrelationId } =
    await import("./server/observability/render-errors");
  // Do not send request.path (may contain identifiers/query strings), cookies or other headers.
  await reportRenderFailure(error, {
    requestId: safeCorrelationId(request.headers["x-request-id"]) ?? crypto.randomUUID(),
    operation: "rsc.render",
  });
};
