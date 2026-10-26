import { z } from "zod";
import { withApi } from "@/server/http/errors";
import { assertSameOrigin } from "@/server/http/security";
import { respondInvitation } from "@/features/client-invites/server/service";
export const POST = withApi(async (request: Request) => {
  assertSameOrigin(request);
  const { token, action } = z
    .object({ token: z.string().max(100), action: z.enum(["accept", "decline"]) })
    .parse(await request.json());
  // respondInvitation commits audit() and notifications atomically with acceptance.
  return Response.json(
    { data: await respondInvitation(request, token, action) },
    { headers: { "Cache-Control": "no-store" } },
  );
});
