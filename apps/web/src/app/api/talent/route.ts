import { listTalent } from "@/features/talent/server/queries";
import { talentQuerySchema } from "@/features/talent/server/schemas";
import { withApi } from "@/server/http/errors";

export const GET = withApi(async (request: Request) => {
  const input = talentQuerySchema.parse(Object.fromEntries(new URL(request.url).searchParams));
  return Response.json(await listTalent(input));
});
