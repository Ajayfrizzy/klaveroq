import { describe, expect, it } from "vitest";
import { activityDestination, describeActivity, formatEventTime } from "./presentation";
import { deviceSummary } from "../security/device-summary";

describe("customer activity presentation", () => {
  it("uses repository event names and preserves an honest fallback", () => {
    expect(describeActivity("profile.avatar_uploaded")).toBe("You uploaded a profile photo.");
    expect(describeActivity("session.revoked")).toBe("A signed-in device was removed.");
    expect(describeActivity("ai.job_draft_generated")).toBe("You generated a job draft.");
    expect(describeActivity("provider.future_event")).toBe("An account action was recorded.");
    expect(activityDestination("provider.future_event")).toBeNull();
    expect(activityDestination("job.created")).toBe("/jobs");
  });
  it("formats timestamps in a stable explicit timezone", () => {
    expect(formatEventTime("2026-09-28T09:30:00Z")).toBe("28 Sept 2026, 09:30 UTC");
  });
  it("recognizes overlapping browser tokens without exposing the raw agent", () => {
    expect(
      deviceSummary("Mozilla/5.0 (Windows NT 10.0) Chrome/130.0 Safari/537.36 Edg/130.0"),
    ).toBe("Edge on Windows");
    expect(deviceSummary("Mozilla/5.0 (iPhone; CPU iPhone OS 18) CriOS/130.0 Safari/604.1")).toBe(
      "Chrome on iOS",
    );
    expect(deviceSummary(null)).toBe("Unknown device");
  });
});
