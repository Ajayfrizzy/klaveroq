import { randomUUID } from "node:crypto";
import { cache } from "react";
import { headers } from "next/headers";
import { safeCorrelationId } from "./render-errors";

// React cache is scoped to this render, never to an account across requests.
export const getRenderRequestId = cache(
  async () => safeCorrelationId((await headers()).get("x-request-id")) ?? randomUUID(),
);
