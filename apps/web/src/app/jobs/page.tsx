import DiscoverPage from "@/app/discover/page";
import JobsWorkspace from "@/features/jobs/components/jobs-workspace";
export const dynamic = "force-dynamic";
export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { view } = await searchParams;
  return {
    title: view ? "My jobs" : "Find work",
    description: view
      ? "Your Klaveroq workspace."
      : "Explore open opportunities with clear milestones and verifiable delivery.",
  };
}
export default async function JobsPage(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await props.searchParams;
  return params.view ? <JobsWorkspace {...props} /> : <DiscoverPage {...props} />;
}
