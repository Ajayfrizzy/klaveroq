import { z } from "zod";
import { withApi } from "@/server/http/errors";
import { assertSameOrigin } from "@/server/http/security";
import { manageInvitation } from "@/features/client-invites/server/service";
export const POST = withApi(
  async (request: Request, context: RouteContext<"/api/client-invites/[id]">) => {
    assertSameOrigin(request);
    const id = z
      .string()
      .uuid()
      .parse((await context.params).id);
    const { action } = z
      .object({ action: z.enum(["resend", "revoke"]) })
      .parse(await request.json());
    // manageInvitation records audit() inside its transaction.
    return Response.json(
      { data: await manageInvitation(request, id, action) },
      { headers: { "Cache-Control": "no-store" } },
    );
  },
);
