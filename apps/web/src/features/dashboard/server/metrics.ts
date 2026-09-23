export type DashboardOperation = {
  type: string;
  status: string;
  amount: bigint | null;
  asset: string | null;
  createdAt: Date;
};

export function confirmedFinancialSummary(records: DashboardOperation[], now = new Date()) {
  const confirmed = records.filter(
    (record) => record.status === "CONFIRMED" && record.amount !== null,
  );
  const funding = confirmed.filter((record) => record.type === "FUND");
  const released = confirmed.filter(
    (record) =>
      ["MILESTONE_RELEASE", "RELEASE"].includes(record.type) &&
      record.createdAt.getUTCFullYear() === now.getUTCFullYear() &&
      record.createdAt.getUTCMonth() === now.getUTCMonth(),
  );
  const sum = (items: DashboardOperation[]) =>
    items.reduce((total, item) => total + (item.amount ?? 0n), 0n);
  return {
    secured: funding.length
      ? { amount: sum(funding), asset: funding[0].asset ?? "CKB", count: funding.length }
      : null,
    released: released.length
      ? { amount: sum(released), asset: released[0].asset ?? "CKB", count: released.length }
      : null,
  };
}
