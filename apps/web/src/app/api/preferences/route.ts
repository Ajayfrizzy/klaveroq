import { requireUser } from "@/server/auth/session";
import { withApi } from "@/server/http/errors";
import { assertSameOrigin } from "@/server/http/security";
import { audit } from "@/server/audit";
import { readPreferences, savePreferences } from "@/server/preferences";
import { importSchema } from "@/features/preferences/schema";

export const GET = withApi(async () => {
  const { user } = await requireUser();
  return Response.json({ data: await readPreferences(user.id) });
});
export const PATCH = withApi(async (request: Request) => {
  assertSameOrigin(request);
  const { user } = await requireUser();
  const input = importSchema
    .pick({ workspaceFocus: true })
    .required()
    .parse(await request.json());
  const data = await savePreferences(user.id, { ...input, searches: [], talentIds: [] });
  await audit(request, {
    actorUserId: user.id,
    action: "preferences.focus_updated",
    entityType: "user",
    entityId: user.id,
  });
  return Response.json({ data });
});
