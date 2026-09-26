import { buildJobSuggestion } from "@/features/ai/server/service";
import { jobBuilderInputSchema } from "@/features/ai/schemas";
import { audit } from "@/server/audit";
import { requireUser } from "@/server/auth/session";
import { withApi } from "@/server/http/errors";
import { assertSameOrigin } from "@/server/http/security";

export const POST = withApi(async (request: Request) => {
  assertSameOrigin(request);
  const { user } = await requireUser();
  const input = jobBuilderInputSchema.parse(await request.json());
  const suggestion = await buildJobSuggestion(input.description);
  await audit(request, {
    actorUserId: user.id,
    action: "ai.job_draft_generated",
    entityType: "job_listing_draft",
    metadata: { provider: process.env.MARKETPLACE_AI_PROVIDER ?? "template" },
  });
  return Response.json({ data: suggestion });
});
