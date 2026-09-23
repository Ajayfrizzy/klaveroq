import { describe, expect, it } from "vitest";
import {
  pendingActionSummary,
  pendingActionTitle,
  prioritizePendingActions,
  type PendingAction,
} from "./pending-actions";

const action = (id: string, day: number): PendingAction => ({
  id,
  jobId: `job-${id}`,
  title: "Review milestone proof",
  detail: `Job ${id}`,
  note: `Milestone ${id}`,
  urgencyAt: new Date(Date.UTC(2026, 8, day)),
  createdAt: new Date(Date.UTC(2026, 7, day)),
});

describe("pending dashboard actions", () => {
  it("includes an older actionable job beyond the 20 recent active jobs", () => {
    const candidates = Array.from({ length: 21 }, (_, index) =>
      action(String(index + 1), index + 1),
    );
    const summary = pendingActionSummary(0, 21, candidates);
    expect(summary.pendingActionCount).toBe(21);
    expect(summary.pendingActions).toHaveLength(4);
    expect(summary.pendingActions[0]?.id).toBe("1");
  });

  it("keeps client and worker actions role-specific", () => {
    expect(pendingActionTitle("CLIENT", "IN_PROGRESS", ["UNDER_REVIEW"])).toBe(
      "Review milestone proof",
    );
    expect(pendingActionTitle("WORKER", "IN_PROGRESS", ["UNDER_REVIEW"])).toBeNull();
    expect(pendingActionTitle("WORKER", "IN_PROGRESS", ["REVISION_REQUESTED"])).toBe(
      "Submit milestone revision",
    );
    expect(pendingActionTitle("CLIENT", "IN_PROGRESS", ["REVISION_REQUESTED"])).toBeNull();
    expect(pendingActionTitle("WORKER", "FUNDED_AWAITING_ACCEPTANCE", [])).toBe(
      "Accept funded invitation",
    );
    expect(pendingActionTitle("CLIENT", "FUNDED_AWAITING_ACCEPTANCE", [])).toBeNull();
  });

  it("retains distinct actionable milestones and removes duplicate task rows", () => {
    const first = action("milestone-1", 2);
    const second = action("milestone-2", 1);
    expect(prioritizePendingActions([first, second, { ...first }])).toEqual([second, first]);
  });

  it("excludes completed agreements and handles no pending actions", () => {
    expect(pendingActionTitle("CLIENT", "COMPLETED", ["UNDER_REVIEW"])).toBeNull();
    expect(pendingActionTitle("WORKER", "COMPLETED", ["REVISION_REQUESTED"])).toBeNull();
    expect(pendingActionSummary(0, 0, [])).toEqual({
      pendingActionCount: 0,
      pendingActions: [],
    });
  });

  it("orders equal deadlines chronologically and then by stable task ID", () => {
    const later = { ...action("b", 1), createdAt: new Date("2026-08-02T00:00:00Z") };
    const earlierB = { ...action("b", 1), createdAt: new Date("2026-08-01T00:00:00Z") };
    const earlierA = { ...action("a", 1), createdAt: new Date("2026-08-01T00:00:00Z") };
    expect(prioritizePendingActions([later, earlierB, earlierA]).map((item) => item.id)).toEqual([
      "a",
      "b",
    ]);
  });
});
