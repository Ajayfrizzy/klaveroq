export type NotificationCategory =
  "PROPOSAL" | "MESSAGE" | "JOB" | "DISPUTE" | "SUPPORT" | "SECURITY";

export function preferenceAllowsEmail(
  category: NotificationCategory,
  preferences?: {
    proposalEmails: boolean;
    messageEmails: boolean;
    jobEmails: boolean;
    disputeEmails: boolean;
    supportEmails: boolean;
  } | null,
) {
  if (category === "SECURITY") return true;
  if (!preferences) return true;
  return {
    PROPOSAL: preferences.proposalEmails,
    MESSAGE: preferences.messageEmails,
    JOB: preferences.jobEmails,
    DISPUTE: preferences.disputeEmails,
    SUPPORT: preferences.supportEmails,
  }[category];
}

export function retryDelayMs(attempts: number) {
  return Math.min(24 * 60 * 60 * 1000, 60_000 * 2 ** Math.max(0, attempts - 1));
}
