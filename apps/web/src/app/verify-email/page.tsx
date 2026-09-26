import { Suspense } from "react";
import { VerifyEmailForm } from "@/features/auth/components/verify-email-form";

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<main className="auth-page" />}>
      <VerifyEmailForm />
    </Suspense>
  );
}
