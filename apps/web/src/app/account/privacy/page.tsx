import { PolicyLinks } from "@/features/legal/policy-links";
import Link from "next/link";
import { PrivacyForm } from "@/features/account/privacy-form";
export const metadata = { title: "Privacy requests | Klaveroq" };
export default function Privacy() {
  return (
    <main className="auth-page">
      <section className="auth-panel auth-status-panel">
        <h1>Privacy and account support</h1>
        <p>
          Request earlier handling, a retention review, or help recovering an account. The 30-day
          recovery period is a product policy, not a legal response deadline.
        </p>
        <p>
          Do not include passwords, recovery codes, identity documents or payment secrets. This form
          records a request for authorized review; it does not automatically change your account.
        </p>
        <PolicyLinks slugs={["privacy", "account-deletion"]} />
        <PrivacyForm />
        <Link href="/account/recover">Recover account</Link>
        <Link href="/">Back to Klaveroq</Link>
      </section>
    </main>
  );
}
