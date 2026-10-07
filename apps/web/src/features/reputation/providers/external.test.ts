import { expect, it } from "vitest";
import { externalReputationProvider } from "./external";
it("keeps external credentials disconnected without fabricating claims", async () => {
  expect(await externalReputationProvider.getPublishedClaims("public-profile")).toBeNull();
});
