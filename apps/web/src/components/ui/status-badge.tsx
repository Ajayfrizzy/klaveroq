import type { AgreementStatus, MilestoneStatus } from "@klaveroq/domain";

const labels: Partial<Record<AgreementStatus | MilestoneStatus, string>> = {
  FUNDED_AWAITING_ACCEPTANCE: "Awaiting acceptance",
  IN_PROGRESS: "In progress",
  DISPUTED: "Disputed",
  SECURITY_HOLD: "Security hold",
};

export function StatusBadge({ status }: { status: AgreementStatus | MilestoneStatus }) {
  const text =
    status === "UNDER_REVIEW"
      ? "Under review"
      : (labels[status] ?? status.toLowerCase().replaceAll("_", " "));
  return <span className={`status-badge status-${status.toLowerCase()}`}>{text}</span>;
}
