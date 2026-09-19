import type { jobs } from "../../../server/db/schema";
import { ApiError } from "../../../server/http/errors";

type Engagement = Pick<typeof jobs.$inferSelect, "clientUserId" | "workerUserId" | "status">;

export function reviewSubjectFor(engagement: Engagement, reviewerUserId: string) {
  if (engagement.status !== "COMPLETED")
    throw new ApiError(
      409,
      "ENGAGEMENT_NOT_COMPLETED",
      "Reviews are available after the Klaveroq engagement is completed.",
    );
  if (engagement.clientUserId === reviewerUserId && engagement.workerUserId)
    return engagement.workerUserId;
  if (engagement.workerUserId === reviewerUserId) return engagement.clientUserId;
  throw new ApiError(
    403,
    "REVIEW_NOT_ALLOWED",
    "Only participants in this completed engagement can leave a review.",
  );
}
