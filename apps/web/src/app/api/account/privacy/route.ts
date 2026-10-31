import { audit } from "@/server/audit";
import { z } from "zod";
import { withApi } from "@/server/http/errors";
import { accountRateLimit } from "@/server/account/http";
import { db } from "@/server/db";
import { accountPrivacyRequests } from "@/server/db/schema";
export const POST = withApi(async (request: Request) => {
  const input = z
    .object({
      email: z
        .string()
        .email()
        .max(320)
        .transform((v) => v.toLowerCase()),
      message: z.string().trim().min(10).max(2000),
    })
    .parse(await request.json());
  await accountRateLimit(request, input.email, "account_privacy");
  const record = await db.transaction(async (tx) => {
    const [record] = await tx
      .insert(accountPrivacyRequests)
      .values(input)
      .returning({ id: accountPrivacyRequests.id });
    await audit(
      request,
      { action: "account.privacy_requested", entityType: "privacy_request", entityId: record.id },
      tx,
    );
    return record;
  });
  return Response.json({ data: { reference: record.id } }, { status: 201 });
});
