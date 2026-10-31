export const usableAccountStatuses = ["ACTIVE", "PENDING_EMAIL_VERIFICATION"] as const;
export function accountCanAuthenticate(status: string) {
  return (usableAccountStatuses as readonly string[]).includes(status);
}
export const RECOVERY_DAYS = 30;
export function recoveryOpen(deadline: Date, now: Date) {
  return now.getTime() < deadline.getTime();
}
