export type CandidatePage<TCandidate, TCursor> = {
  items: readonly TCandidate[];
  nextCursor: TCursor | null;
};

export async function findFirstEligibleCandidate<TCandidate, TCursor, TResult>(
  loadPage: (cursor: TCursor | undefined) => Promise<CandidatePage<TCandidate, TCursor>>,
  inspect: (candidate: TCandidate) => Promise<TResult | undefined>,
): Promise<TResult | undefined> {
  let cursor: TCursor | undefined;
  while (true) {
    const page = await loadPage(cursor);
    for (const candidate of page.items) {
      const result = await inspect(candidate);
      if (result !== undefined) return result;
    }
    if (page.nextCursor === null) return undefined;
    cursor = page.nextCursor;
  }
}
