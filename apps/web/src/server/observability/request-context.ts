import { randomUUID } from "node:crypto";

const requestIds = new WeakMap<Request, string>();
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function getRequestId(request: Request) {
  const existing = requestIds.get(request);
  if (existing) return existing;
  const supplied = request.headers.get("x-request-id")?.trim();
  const requestId = supplied && uuidPattern.test(supplied) ? supplied : randomUUID();
  requestIds.set(request, requestId);
  return requestId;
}
