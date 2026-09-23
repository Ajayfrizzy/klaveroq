export type DashboardOperation = {
  id?: string;
  jobId?: string | null;
  milestoneId?: string | null;
  idempotencyKey?: string;
  externalReference?: string | null;
  type: string;
  status: string;
  amount: bigint | null;
  asset: string | null;
  assetDecimals?: number;
  createdAt: Date;
};

export type AssetTotal = {
  amount: bigint;
  asset: string;
  assetDecimals: number;
  count: number;
};

const releaseTypes = new Set(["MILESTONE_RELEASE", "RELEASE"]);

export function utcMonthRange(now = new Date()) {
  return {
    start: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)),
    end: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)),
  };
}

function settlementKey(record: DashboardOperation) {
  if (
    !releaseTypes.has(record.type) ||
    !record.externalReference ||
    !record.jobId ||
    !record.milestoneId ||
    !record.asset ||
    record.assetDecimals === undefined ||
    record.amount === null
  )
    return null;
  return [
    "RELEASE",
    record.jobId,
    record.milestoneId,
    record.asset,
    record.assetDecimals,
    record.amount,
    record.externalReference,
  ].join(":");
}

function unique(records: DashboardOperation[]) {
  const seen = new Set<string>();
  return records.filter((record) => {
    const key = settlementKey(record);
    if (!key) return true;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function groupByAsset(records: DashboardOperation[]): AssetTotal[] {
  const totals = new Map<string, AssetTotal>();
  for (const record of unique(records)) {
    if (record.amount === null || !record.asset) continue;
    const assetDecimals = record.assetDecimals ?? 0;
    const key = `${record.asset}:${assetDecimals}`;
    const current = totals.get(key) ?? {
      amount: 0n,
      asset: record.asset,
      assetDecimals,
      count: 0,
    };
    current.amount += record.amount;
    current.count += 1;
    totals.set(key, current);
  }
  return [...totals.values()].sort((left, right) => left.asset.localeCompare(right.asset));
}

export function confirmedFinancialSummary(records: DashboardOperation[], now = new Date()) {
  const confirmed = records.filter(
    (record) => record.status === "CONFIRMED" && record.amount !== null && record.asset,
  );
  const { start, end } = utcMonthRange(now);
  return {
    // PactAgent balances are not reconciled into the current schema. Historical operations
    // must not be presented as the amount currently held in escrow.
    secured: null,
    funding: groupByAsset(confirmed.filter((record) => record.type === "FUND")),
    released: groupByAsset(
      confirmed.filter(
        (record) =>
          releaseTypes.has(record.type) && record.createdAt >= start && record.createdAt < end,
      ),
    ),
  };
}

export function formatAssetAmount(amount: bigint, decimals: number) {
  if (decimals <= 0) return new Intl.NumberFormat("en-US").format(amount);
  const negative = amount < 0n;
  const absolute = negative ? -amount : amount;
  const scale = 10n ** BigInt(decimals);
  const whole = absolute / scale;
  const fraction = (absolute % scale).toString().padStart(decimals, "0").replace(/0+$/, "");
  return `${negative ? "-" : ""}${new Intl.NumberFormat("en-US").format(whole)}${fraction ? `.${fraction}` : ""}`;
}

export function presentAssetTotals(totals: AssetTotal[], emptyNote: string) {
  if (!totals.length) return { value: "0", note: emptyNote };
  if (totals.length === 1) {
    const total = totals[0];
    return {
      value: `${formatAssetAmount(total.amount, total.assetDecimals)} ${total.asset}`,
      note: `${total.count} confirmed operation${total.count === 1 ? "" : "s"}`,
    };
  }
  return {
    value: "Multiple assets",
    note: totals
      .map((total) => `${formatAssetAmount(total.amount, total.assetDecimals)} ${total.asset}`)
      .join(" · "),
  };
}
