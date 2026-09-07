import { AppShell } from "@/components/layout/app-shell";
import { PageSkeleton } from "@/components/ui/page-skeleton";

export default function DirectJobLoading() {
  return (
    <AppShell>
      <PageSkeleton cards={2} />
    </AppShell>
  );
}
