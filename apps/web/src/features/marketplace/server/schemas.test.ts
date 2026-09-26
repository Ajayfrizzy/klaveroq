import { describe, expect, it } from "vitest";
import {
  listingInputSchema,
  listingQuerySchema,
  listingUpdateSchema,
  proposalInputSchema,
} from "./schemas";
import { encodeCursor } from "../../../server/pagination/cursor";

const listing = {
  title: "Build an analytics dashboard",
  description: "Create a responsive analytics dashboard with accessible charts and filters.",
  category: "DEVELOPMENT" as const,
  skills: ["React", "TypeScript", "react"],
  budgetMin: "100",
  budgetMax: "200",
  proposalDeadline: new Date(Date.now() + 86_400_000),
  milestones: [
    {
      title: "Working delivery",
      deliverable: "A complete review-ready dashboard delivery.",
      acceptanceCriteria: "The agreed dashboard states work at responsive breakpoints.",
      evidenceRequirements: "Preview URL and test report",
      deliveryDays: 14,
    },
  ],
};
describe("marketplace schemas", () => {
  it("normalizes and deduplicates skills", () => {
    expect(listingInputSchema.parse(listing).skills).toEqual(["react", "typescript"]);
  });
  it("rejects an inverted budget", () => {
    expect(() => listingInputSchema.parse({ ...listing, budgetMin: "300" })).toThrow();
  });
  it("accepts milestone structure when updating an existing draft", () => {
    const update = listingUpdateSchema.parse({
      title: "Updated analytics dashboard",
      milestones: [
        {
          ...listing.milestones[0],
          title: "Updated delivery",
          deliveryDays: 21,
        },
      ],
    });
    expect(update.milestones?.[0]).toMatchObject({
      title: "Updated delivery",
      deliveryDays: 21,
    });
  });
  it("treats blank discovery filters as absent", () => {
    expect(
      listingQuerySchema.parse({
        query: "",
        category: "",
        skill: "",
        minBudget: "",
        maxBudget: "",
        deadlineBefore: "",
        cursor: "",
        limit: "",
      }),
    ).toEqual({ sort: "newest", limit: 12 });
  });
  it("accepts only a cursor matching the requested listing sort", () => {
    const id = "00000000-0000-4000-8000-000000000001";
    const newest = encodeCursor({ kind: "listing-date", value: new Date().toISOString(), id });
    expect(listingQuerySchema.parse({ cursor: newest }).cursor).toBe(newest);
    expect(() => listingQuerySchema.parse({ sort: "budget", cursor: newest })).toThrow(
      /Invalid pagination cursor/,
    );
    expect(() => listingQuerySchema.parse({ cursor: "not-a-cursor" })).toThrow(
      /Invalid pagination cursor/,
    );
  });
  it("accepts milestones whose total and duration match", () => {
    expect(
      proposalInputSchema.parse({
        coverLetter:
          "I will deliver the complete dashboard with tested responsive and accessible states.",
        totalBid: "200",
        estimatedDurationDays: 14,
        milestones: [
          {
            title: "Foundation",
            description: "Build the responsive component foundation.",
            acceptanceCriteria: "The responsive shell matches the agreed states.",
            amount: "80",
            evidenceRequirements: "Preview URL",
            deliveryDays: 7,
          },
          {
            title: "Complete dashboard",
            description: "Finish charts, filters, testing, and handoff.",
            acceptanceCriteria: "Charts and filters pass the agreed functional checks.",
            amount: "120",
            evidenceRequirements: "Test report",
            deliveryDays: 14,
          },
        ],
      }).totalBid,
    ).toBe("200");
  });
  it("rejects mismatched totals and non-increasing delivery dates", () => {
    expect(() =>
      proposalInputSchema.parse({
        coverLetter:
          "I will deliver the complete dashboard with tested responsive and accessible states.",
        totalBid: "300",
        estimatedDurationDays: 7,
        milestones: [
          {
            title: "Foundation",
            description: "Build the responsive component foundation.",
            acceptanceCriteria: "The responsive shell matches the agreed states.",
            amount: "200",
            evidenceRequirements: "Preview URL",
            deliveryDays: 7,
          },
          {
            title: "Finish",
            description: "Finish charts and documentation thoroughly.",
            acceptanceCriteria: "The agreed documentation and charts are complete.",
            amount: "50",
            evidenceRequirements: "Test report",
            deliveryDays: 7,
          },
        ],
      }),
    ).toThrow();
  });
});
