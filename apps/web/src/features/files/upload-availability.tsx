"use client";

import { createContext, useContext } from "react";
import { UPLOADS_UNAVAILABLE_MESSAGE } from "./upload-policy";

const UploadAvailability = createContext(false);

export function UploadAvailabilityProvider({
  enabled,
  children,
}: {
  enabled: boolean;
  children: React.ReactNode;
}) {
  return <UploadAvailability.Provider value={enabled}>{children}</UploadAvailability.Provider>;
}

export function useUploadsEnabled() {
  return useContext(UploadAvailability);
}

export function UploadsUnavailable() {
  return (
    <p className="form-help" role="note">
      {UPLOADS_UNAVAILABLE_MESSAGE}
    </p>
  );
}
