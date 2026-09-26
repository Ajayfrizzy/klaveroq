import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/server/db";
import { disputeEvidence, disputeEvents, disputeFiles, disputes, jobs } from "@/server/db/schema";
import { requireUser } from "@/server/auth/session";
import { ApiError, withApi } from "@/server/http/errors";
import { assertSameOrigin } from "@/server/http/security";
import { serialize } from "@/server/serialize";
import {
  deletePrivateFile,
  MAX_PROOF_BYTES,
  MAX_PROOF_FILES,
  storePrivateFile,
} from "@/server/files/storage";
import { notifyUser } from "@/server/notifications/service";
import { audit } from "@/server/audit";

const schema = z.object({
  note: z.string().trim().min(10).max(5000),
});
export const POST = withApi(
  async (request: Request, context: RouteContext<"/api/disputes/[id]/evidence">) => {
    assertSameOrigin(request);
    const { user } = await requireUser();
    const { id } = await context.params;
    const multipart = request.headers.get("content-type")?.includes("multipart/form-data");
    const form = multipart ? await request.formData() : null;
    const input = schema.parse(form ? { note: form.get("note") } : await request.json());
    const files = form
      ? form.getAll("files").filter((value): value is File => value instanceof File)
      : [];
    if (
      files.length > MAX_PROOF_FILES ||
      files.reduce((sum, file) => sum + file.size, 0) > MAX_PROOF_BYTES
    )
      throw new ApiError(
        413,
        "EVIDENCE_LIMIT_EXCEEDED",
        "An evidence entry may contain at most 10 files and 100 MB total.",
      );
    const [record] = await db
      .select({ dispute: disputes, job: jobs })
      .from(disputes)
      .innerJoin(jobs, eq(jobs.id, disputes.jobId))
      .where(eq(disputes.id, id))
      .limit(1);
    if (!record || ![record.job.clientUserId, record.job.workerUserId].includes(user.id))
      throw new ApiError(404, "DISPUTE_NOT_FOUND", "Dispute was not found.");
    if (
      !["OPEN", "EVIDENCE_COLLECTION"].includes(record.dispute.status) ||
      record.dispute.evidenceDueAt < new Date()
    )
      throw new ApiError(409, "EVIDENCE_WINDOW_CLOSED", "The evidence window has closed.");
    const stored: Awaited<ReturnType<typeof storePrivateFile>>[] = [];
    try {
      for (const file of files) stored.push(await storePrivateFile(file));
    } catch (error) {
      await Promise.all(stored.map((item) => deletePrivateFile(item.storageKey)));
      throw error;
    }
    let created;
    try {
      [created] = await db.transaction(async (tx) => {
        const rows = await tx
          .insert(disputeEvidence)
          .values({ disputeId: id, submittedBy: user.id, note: input.note })
          .returning();
        if (files.length)
          await tx.insert(disputeFiles).values(
            files.map((file, index) => ({
              evidenceId: rows[0].id,
              ...stored[index],
              originalName: file.name.slice(0, 255),
            })),
          );
        await tx.insert(disputeEvents).values({
          disputeId: id,
          actorUserId: user.id,
          type: "EVIDENCE_SUBMITTED",
          detail: `${files.length ? `${files.length} file${files.length === 1 ? "" : "s"} and a note were` : "A note was"} added to the case.`,
          metadata: { evidenceId: rows[0].id, fileCount: files.length },
        });
        return rows;
      });
    } catch (error) {
      await Promise.all(stored.map((item) => deletePrivateFile(item.storageKey)));
      throw error;
    }
    const recipientUserId =
      user.id === record.job.clientUserId ? record.job.workerUserId : record.job.clientUserId;
    if (recipientUserId)
      await notifyUser({
        userId: recipientUserId,
        type: "DISPUTE_EVIDENCE_ADDED",
        category: "DISPUTE",
        title: `Evidence added to ${record.dispute.reference}`,
        body: "The other participant added evidence to the dispute.",
        href: `/jobs/${record.job.id}`,
        dedupeKey: `dispute-evidence:${created.id}:${recipientUserId}`,
      });
    await audit(request, {
      actorUserId: user.id,
      action: "dispute.evidence_submitted",
      entityType: "dispute_evidence",
      entityId: created.id,
      metadata: { disputeId: id, fileCount: files.length },
    });
    return Response.json({ data: serialize(created) }, { status: 201 });
  },
);
