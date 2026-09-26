import { withApi } from "@/server/http/errors";

export const GET = withApi(async () =>
  Response.json({ status: "ok", service: "klaveroq-web", time: new Date().toISOString() }),
);
