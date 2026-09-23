export type PendingAction = {
  id: string;
  jobId: string;
  title: string;
  detail: string;
  note: string;
  urgencyAt: Date;
  createdAt: Date;
};

const activeAgreementStatuses = new Set([
  "INVITED",
  "AWAITING_FUNDING",
  "FUNDED_AWAITING_ACCEPTANCE",
  "ACCEPTED",
  "IN_PROGRESS",
  "CANCELLATION_PENDING",
  "DISPUTED",
  "SECURITY_HOLD",
]);

export function prioritizePendingActions(actions: PendingAction[], limit = 4) {
  const unique = new Map(actions.map((action) => [action.id, action]));
  return [...unique.values()]
    .sort(
      (left, right) =>
        left.urgencyAt.getTime() - right.urgencyAt.getTime() ||
        left.createdAt.getTime() - right.createdAt.getTime() ||
        left.id.localeCompare(right.id),
    )
    .slice(0, limit);
}

export function pendingActionSummary(
  invitationCount: number,
  milestoneCount: number,
  candidates: PendingAction[],
) {
  return {
    pendingActionCount: invitationCount + milestoneCount,
    pendingActions: prioritizePendingActions(candidates),
  };
}

export function pendingActionTitle(
  role: "CLIENT" | "WORKER",
  jobStatus: string,
  milestoneStatuses: string[],
) {
  if (!activeAgreementStatuses.has(jobStatus)) return null;
  if (role === "WORKER" && jobStatus === "FUNDED_AWAITING_ACCEPTANCE")
    return "Accept funded invitation";
  if (
    role === "CLIENT" &&
    milestoneStatuses.some((status) => ["PROOF_SUBMITTED", "UNDER_REVIEW"].includes(status))
  )
    return "Review milestone proof";
  if (role === "WORKER" && milestoneStatuses.includes("REVISION_REQUESTED"))
    return "Submit milestone revision";
  return null;
}
