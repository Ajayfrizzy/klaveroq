export function agreementNextAction(
  status: string,
  role: "client" | "worker",
  milestones: string[],
) {
  if (status === "DRAFT")
    return role === "client"
      ? {
          title: "Review and confirm your invitation",
          detail: "Check the milestones and recipient before sending this agreement.",
        }
      : { title: "The client is preparing your invitation", detail: "No work is due yet." };
  if (["INVITED", "AWAITING_FUNDING"].includes(status))
    return {
      title: "Waiting for payment integration",
      detail:
        "This agreement is not ready for work. Funding must be confirmed before the worker can accept or submit deliverables.",
    };
  if (status === "FUNDED_AWAITING_ACCEPTANCE")
    return role === "worker"
      ? {
          title: "Review and accept the invitation",
          detail: "Read the milestones and deadlines before accepting the funded agreement.",
        }
      : {
          title: "Waiting for the worker to accept",
          detail: "The worker needs to review the agreement before work begins.",
        };
  if (status === "DISPUTED")
    return {
      title: "Review your dispute",
      detail:
        "Check the evidence deadline and add any supporting information in the dispute section.",
    };
  if (status === "CANCELLATION_PENDING")
    return {
      title: "Review the cancellation request",
      detail: "Check the request below. A cancellation request does not confirm a refund.",
    };
  if (status === "SECURITY_HOLD")
    return {
      title: "This agreement is on hold",
      detail: "Review your account security or contact support before continuing.",
    };
  if (["ACCEPTED", "IN_PROGRESS"].includes(status)) {
    if (
      role === "client" &&
      milestones.some((s) => ["PROOF_SUBMITTED", "UNDER_REVIEW"].includes(s))
    )
      return {
        title: "Review milestone proof",
        detail:
          "Compare the submitted evidence with the acceptance criteria, then approve or request a revision.",
      };
    if (role === "worker" && milestones.includes("REVISION_REQUESTED"))
      return {
        title: "Submit your revised work",
        detail: "Address the client’s feedback and attach updated proof to the milestone.",
      };
    return role === "worker"
      ? {
          title: "Continue your milestones",
          detail: "Follow the agreed criteria and submit proof when each milestone is ready.",
        }
      : {
          title: "Work is underway",
          detail:
            "The worker will submit proof for you to review. Check the milestones for progress.",
        };
  }
  if (status === "COMPLETED")
    return {
      title: "Share a review",
      detail: "Your agreement is complete. Leave feedback about the collaboration below.",
    };
  return {
    title: "Review agreement history",
    detail: "Check the milestones and recorded outcome. Contact support if you need help.",
  };
}
