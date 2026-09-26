import { and, eq, or } from "drizzle-orm";
import { requireUser } from "@/server/auth/session";
import { db } from "@/server/db";
import { disputeEvidence, disputeFiles, disputes, jobs } from "@/server/db/schema";
import { readPrivateFile } from "@/server/files/storage";
import { ApiError, withApi } from "@/server/http/errors";

export const GET = withApi(
  async (_request: Request, context: RouteContext<"/api/dispute-files/[id]">) => {
    const { user } = await requireUser();
    const { id } = await context.params;
    const participant = or(eq(jobs.clientUserId, user.id), eq(jobs.workerUserId, user.id));
    const admin = ["DISPUTE_ADMIN", "SUPER_ADMIN"].includes(user.systemRole);
    const [record] = await db
      .select({ file: disputeFiles })
      .from(disputeFiles)
      .innerJoin(disputeEvidence, eq(disputeEvidence.id, disputeFiles.evidenceId))
      .innerJoin(disputes, eq(disputes.id, disputeEvidence.disputeId))
      .innerJoin(jobs, eq(jobs.id, disputes.jobId))
      .where(and(eq(disputeFiles.id, id), admin ? undefined : participant))
      .limit(1);
    if (!record || record.file.scanStatus !== "CLEAN")
      throw new ApiError(404, "FILE_NOT_FOUND", "File was not found or is not available.");
    const bytes = await readPrivateFile(record.file.storageKey);
    return new Response(bytes, {
      headers: {
        "Content-Type": record.file.contentType,
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(record.file.originalName)}`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  },
);
