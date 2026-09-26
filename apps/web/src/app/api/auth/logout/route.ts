import { getCurrentUser, revokeCurrentSession } from "@/server/auth/session";
import { withApi } from "@/server/http/errors";
import { assertSameOrigin } from "@/server/http/security";
import { audit } from "@/server/audit";

export const POST = withApi(async (request: Request) => {
  assertSameOrigin(request);
  const current = await getCurrentUser();
  await revokeCurrentSession();
  if (current)
    await audit(request, {
      actorUserId: current.user.id,
      action: "session.current_revoked",
      entityType: "session",
      entityId: current.sessionId,
    });
  return new Response(null, { status: 204 });
});
