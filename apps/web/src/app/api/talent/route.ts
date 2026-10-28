import { getCurrentUser } from "@/server/auth/session";
import { listTalent } from "@/features/talent/server/queries";
import { talentQuerySchema } from "@/features/talent/server/schemas";
import { withApi } from "@/server/http/errors";

export const GET = withApi(async (request: Request) => {
  const input = talentQuerySchema.parse(Object.fromEntries(new URL(request.url).searchParams));
  const current = await getCurrentUser();
  return Response.json(await listTalent(input, current?.user.id));
});
