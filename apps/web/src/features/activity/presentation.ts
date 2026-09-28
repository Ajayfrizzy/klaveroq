/** Presentation only: the canonical action and identifiers stay in the audit record. */
const descriptions: Record<string, string> = {
  "account.registered": "You created your account.",
  "account.email_verified": "You verified your email address.",
  "account.email_verification_resent": "You requested another verification email.",
  "account.password_reset_requested": "You requested a password reset.",
  "account.password_reset_completed": "You reset your password.",
  "profile.updated": "You updated your profile.",
  "profile.updated_and_made_private": "You saved your profile privately.",
  "profile.published": "You published your professional profile.",
  "profile.made_private": "You made your profile private.",
  "profile.avatar_uploaded": "You uploaded a profile photo.",
  "profile.avatar_replaced": "You replaced your profile photo.",
  "profile.avatar_deleted": "You removed your profile photo.",
  "portfolio.created": "You added a portfolio project.",
  "portfolio.updated": "You updated a portfolio project.",
  "portfolio.deleted": "You removed a portfolio project.",
  "portfolio.media_uploaded": "You uploaded portfolio media.",
  "portfolio.media_replaced": "You replaced portfolio media.",
  "portfolio.media_deleted": "You removed portfolio media.",
  "session.created": "You signed in to your account.",
  "session.created_with_mfa": "You signed in with two-factor authentication.",
  "session.current_revoked": "You signed out of your account.",
  "session.revoked": "A signed-in device was removed.",
  "mfa.enrollment_started": "You started setting up two-factor authentication.",
  "mfa.enabled": "You enabled two-factor authentication.",
  "mfa.disabled": "You disabled two-factor authentication.",
  "identity.started": "You started identity verification.",
  "identity.verified": "Your identity verification was recorded.",
  "identity.failed": "Your identity verification did not pass.",
  "identity.pending": "Your identity verification is pending.",
  "wallet.challenge_created": "You requested a wallet ownership check.",
  "wallet.verified": "You verified ownership of a wallet address.",
  "wallet.default_changed": "You changed your default wallet address.",
  "wallet.revoked": "You removed a wallet address.",
  "ai.job_draft_generated": "You generated a job draft.",
  "ai.proposal_draft_generated": "You generated a proposal draft.",
  "fee_quote.created": "You requested a fee estimate.",
  "job.created": "You created an unfunded agreement.",
  "job.draft_confirmed": "You confirmed an agreement draft.",
  "job.accepted": "You accepted an agreement.",
  "job.cancelled_before_funding": "You cancelled an unfunded agreement.",
  "job.preaccept_refund_requested": "You requested a refund before acceptance.",
  "job.cancellation_requested": "You requested agreement cancellation.",
  "job.cancellation_declined": "You declined a cancellation request.",
  "job.cancellation_accepted": "You accepted a cancellation request.",
  "listing.created": "You created a job listing draft.",
  "listing.updated": "You updated a job listing.",
  "listing.published": "You published a job listing.",
  "listing.closed": "You closed a job listing.",
  "listing.cancelled": "You cancelled a job listing.",
  "proposal.submitted": "You submitted a proposal.",
  "proposal.updated": "You updated a proposal.",
  "proposal.withdrawn": "You withdrew a proposal.",
  "proposal.rejected": "You declined a proposal.",
  "proposal.awarded": "You selected a proposal for an agreement.",
  "proposal.message_sent": "You sent a proposal message.",
  "proof.submitted": "You submitted milestone proof.",
  "proof.files_uploaded": "You uploaded milestone evidence.",
  "milestone.proof_approved": "You approved milestone proof; release is pending.",
  "milestone.revision_requested": "You requested a milestone revision.",
  "dispute.opened": "You opened a dispute.",
  "dispute.evidence_submitted": "You submitted dispute evidence.",
  "marketplace.review_created": "You reviewed a completed engagement.",
  "support.ticket.created": "You opened a support case.",
  "support.ticket.closed": "You closed a support case.",
  "support.ticket.reopened": "You reopened a support case.",
  "support.message_sent": "You sent a support message.",
  "support.attachment_uploaded": "You uploaded a support attachment.",
  "notification.all_read": "You marked all notifications as read.",
  "notification.read": "You marked a notification as read.",
  "notification.unread": "You marked a notification as unread.",
  "notification.preferences_updated": "You updated notification preferences.",
};

export function describeActivity(action: string) {
  return descriptions[action] ?? "An account action was recorded.";
}

// Link to authorized account workspaces, never infer access from an audit entity ID.
export function activityDestination(action: string) {
  const category = action.split(".")[0];
  if (["profile", "portfolio"].includes(category)) return "/profile";
  if (["account", "session", "mfa", "wallet", "identity"].includes(category)) return "/wallet";
  if (
    ["job", "listing", "proposal", "proof", "milestone", "dispute", "marketplace"].includes(
      category,
    )
  )
    return "/jobs";
  if (category === "support") return "/support";
  if (category === "notification") return "/notifications";
  return null;
}

export function formatEventTime(date: Date | string) {
  return (
    new Intl.DateTimeFormat("en-GB", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "UTC",
    }).format(new Date(date)) + " UTC"
  );
}
