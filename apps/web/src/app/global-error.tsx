"use client";

import { RenderError } from "@/components/ui/render-error";

export default function GlobalError({
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <html lang="en">
      <body>
        <RenderError retry={retry} />
      </body>
    </html>
  );
}
