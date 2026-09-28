import { requireUser } from "@/server/auth/session";
import { withApi } from "@/server/http/errors";
import { assertSameOrigin } from "@/server/http/security";
import { audit } from "@/server/audit";
import { savePreferences } from "@/server/preferences";
import { importSchema } from "@/features/preferences/schema";

export const POST = withApi(async (request: Request) => {
  assertSameOrigin(request);
  const { user } = await requireUser();
  const data = await savePreferences(user.id, importSchema.parse(await request.json()), true);
  await audit(request, {
    actorUserId: user.id,
    action: "preferences.device_imported",
    entityType: "user",
    entityId: user.id,
  });
  return Response.json({ data });
});
