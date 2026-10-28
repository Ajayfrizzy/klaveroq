"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

export function SectionUnavailable({ label }: { label: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <div role="status" className="market-empty compact-empty">
      <p>{label} is temporarily unavailable. Your account information has not been changed.</p>
      <button
        className="secondary-button"
        disabled={pending}
        onClick={() => startTransition(() => router.refresh())}
      >
        {pending ? "Retrying…" : `Retry ${label.toLowerCase()}`}
      </button>
    </div>
  );
}
