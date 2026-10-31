import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/server/auth/session";
import { LifecycleForm } from "@/features/account/lifecycle-form";
export const metadata = { title: "Account settings | Klaveroq", referrer: "no-referrer" as const };
export default async function AccountSettings() {
  const current = await getCurrentUser();
  if (!current) redirect("/login?returnTo=/account/settings");
  return (
    <main className="auth-page">
      <Suspense>
        <LifecycleForm
          mode="delete"
          initialEmail={current.user.email}
          hasPassword={Boolean(current.user.passwordHash)}
          profileMissing={!current.profile}
        />
      </Suspense>
    </main>
  );
}
