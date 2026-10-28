import { fileUploadsEnabled, UPLOADS_UNAVAILABLE_MESSAGE } from "@/features/files/upload-policy";
import { ApiError } from "../http/errors";

export function assertFileUploadsEnabled() {
  if (!fileUploadsEnabled())
    throw new ApiError(503, "FILE_UPLOADS_DISABLED", UPLOADS_UNAVAILABLE_MESSAGE);
}
