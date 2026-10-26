import { withApi } from "@/server/http/errors";
import { assertSameOrigin } from "@/server/http/security";
import {
  createInvitation,
  invitationHistory,
  inviteUser,
} from "@/features/client-invites/server/service";
export const GET = withApi(async () => {
  const { user } = await inviteUser();
  return Response.json(
    { data: await invitationHistory(user.id) },
    { headers: { "Cache-Control": "no-store" } },
  );
});
export const POST = withApi(async (request: Request) => {
  assertSameOrigin(request);
  // createInvitation commits audit() with the invitation and queued email.
  return Response.json(
    { data: await createInvitation(request, await request.json()) },
    { status: 201, headers: { "Cache-Control": "no-store" } },
  );
});
