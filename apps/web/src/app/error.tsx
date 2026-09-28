"use client";

import { RenderError } from "@/components/ui/render-error";

// Next's retry() re-fetches RSC data; reset() alone can re-render a failed payload.
export default function PageError({
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return <RenderError retry={retry} />;
}
