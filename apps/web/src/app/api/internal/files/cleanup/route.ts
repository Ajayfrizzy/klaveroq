import { timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { audit } from "@/server/audit";
import { getFileStorage } from "@/server/files/backend";
import { cleanupFilePage } from "@/server/files/cleanup";
import { isFileReferenced } from "@/server/files/references";
import { ApiError, withApi } from "@/server/http/errors";

export const maxDuration = 300;
const input = z
  .object({
    prefix: z.enum(["clean/", "quarantine/"]),
    cursor: z.string().max(4096).optional(),
    dryRun: z.boolean().default(true),
  })
  .strict();

export const POST = withApi(async (request: Request) => {
  const secret = process.env.CRON_SECRET;
  const supplied = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret ?? ""}`);
  if (
    !secret ||
    secret.length < 32 ||
    supplied.length !== expected.length ||
    !timingSafeEqual(supplied, expected)
  )
    throw new ApiError(401, "CRON_UNAUTHORIZED", "A valid cron credential is required.");
  const options = input.parse(await request.json());
  const result = await cleanupFilePage({
    ...options,
    storage: getFileStorage(),
    isReferenced: isFileReferenced,
  });
  await audit(request, {
    action: "internal.file_cleanup",
    entityType: "file_cleanup_run",
    metadata: {
      prefix: options.prefix,
      scanned: result.scanned,
      candidates: result.candidates,
      deleted: result.deleted,
      dryRun: result.dryRun,
    },
  });
  return Response.json({ data: result });
});
