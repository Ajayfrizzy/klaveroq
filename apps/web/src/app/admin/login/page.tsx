import { AdminLoginForm } from "@/features/auth/components/admin-login-form";

export const dynamic = "force-dynamic";

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const unauthorized = (await searchParams).unauthorized === "1";
  return (
    <AdminLoginForm
      initialError={
        unauthorized
          ? "This account does not have permission to open that operations workspace."
          : ""
      }
    />
  );
}
