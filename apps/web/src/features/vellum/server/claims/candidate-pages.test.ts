import { describe, expect, it, vi } from "vitest";
import { findFirstEligibleCandidate } from "./candidate-pages";

describe("settlement candidate pagination", () => {
  it("continues after a full ineligible page", async () => {
    const firstPage = Array.from({ length: 25 }, (_, index) => index + 1);
    const loadPage = vi.fn(async (cursor: number | undefined) =>
      cursor === undefined
        ? { items: firstPage, nextCursor: 25 }
        : { items: [26, 27], nextCursor: null },
    );
    const inspect = vi.fn(async (candidate: number) =>
      candidate === 26 ? `candidate-${candidate}` : undefined,
    );

    await expect(findFirstEligibleCandidate(loadPage, inspect)).resolves.toBe("candidate-26");
    expect(loadPage).toHaveBeenCalledTimes(2);
    expect(loadPage).toHaveBeenNthCalledWith(1, undefined);
    expect(loadPage).toHaveBeenNthCalledWith(2, 25);
    expect(inspect).toHaveBeenCalledTimes(26);
  });

  it("returns undefined after every page is exhausted", async () => {
    const loadPage = vi.fn(async () => ({ items: [1, 2], nextCursor: null }));

    await expect(
      findFirstEligibleCandidate(loadPage, async () => undefined),
    ).resolves.toBeUndefined();
    expect(loadPage).toHaveBeenCalledTimes(1);
  });
});
