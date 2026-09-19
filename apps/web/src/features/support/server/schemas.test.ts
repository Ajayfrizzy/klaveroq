import { describe, expect, it } from "vitest";
import { createMessageSchema, createTicketSchema, updateTicketSchema } from "./schemas";

describe("support schemas", () => {
  it("accepts a complete support case", () => {
    expect(
      createTicketSchema.parse({
        subject: "Funding confirmation delay",
        category: "PAYMENT",
        referenceId: "KQ-DEMO-1048",
        message: "My funding has not appeared after confirmation.",
      }),
    ).toMatchObject({ category: "PAYMENT", referenceId: "KQ-DEMO-1048" });
  });

  it("rejects short or oversized customer content", () => {
    expect(() =>
      createTicketSchema.parse({ subject: "Help", category: "GENERAL", message: "short" }),
    ).toThrow();
    expect(() => createMessageSchema.parse({ message: "x".repeat(5001) })).toThrow();
  });

  it("requires a valid administrative update", () => {
    expect(() => updateTicketSchema.parse({})).toThrow();
    expect(updateTicketSchema.parse({ status: "IN_PROGRESS", priority: "HIGH" })).toEqual({
      status: "IN_PROGRESS",
      priority: "HIGH",
    });
  });
});
