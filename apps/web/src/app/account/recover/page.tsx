import { Suspense } from "react";
import { LifecycleForm } from "@/features/account/lifecycle-form";
export const metadata = { title: "Recover account | Klaveroq", referrer: "no-referrer" as const };
export default function Recover() {
  return (
    <main className="auth-page">
      <Suspense>
        <LifecycleForm mode="recover" />
      </Suspense>
    </main>
  );
}
