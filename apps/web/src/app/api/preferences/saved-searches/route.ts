import { z } from "zod";
import { requireUser } from "@/server/auth/session";
import { withApi } from "@/server/http/errors";
import { assertSameOrigin } from "@/server/http/security";
import { audit } from "@/server/audit";
import { readPreferences, savePreferences, removePreference } from "@/server/preferences";
import { savedSearchSchema } from "@/features/preferences/schema";

export const GET = withApi(async () => {
  const { user } = await requireUser();
  return Response.json({ data: (await readPreferences(user.id)).searches });
});
export const POST = withApi(async (request: Request) => {
  assertSameOrigin(request);
  const { user } = await requireUser();
  const input = savedSearchSchema.parse(await request.json());
  const data = await savePreferences(user.id, { searches: [input], talentIds: [] });
  await audit(request, {
    actorUserId: user.id,
    action: "preferences.search_saved",
    entityType: "user",
    entityId: user.id,
  });
  return Response.json({ data });
});
export const DELETE = withApi(async (request: Request) => {
  assertSameOrigin(request);
  const { user } = await requireUser();
  const input = z
    .object({ id: z.string().uuid().toLowerCase() })
    .strict()
    .parse(await request.json());
  const data = await removePreference(user.id, "search", input.id);
  await audit(request, {
    actorUserId: user.id,
    action: "preferences.search_removed",
    entityType: "user",
    entityId: user.id,
  });
  return Response.json({ data });
});
