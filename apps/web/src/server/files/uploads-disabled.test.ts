import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ db: vi.fn(), scan: vi.fn(), storage: vi.fn(), user: vi.fn() }));
vi.mock("@/server/db", () => ({ db: new Proxy({}, { get: () => mocks.db }) }));
vi.mock("@/server/auth/session", () => ({ requireUser: mocks.user }));
vi.mock("@/server/audit", () => ({ audit: vi.fn() }));
vi.mock("@/server/notifications/service", () => ({ notifyUser: vi.fn() }));
vi.mock("./backend", () => ({ getFileStorage: mocks.storage }));
vi.mock("./scanner", () => ({ scanFileBytes: mocks.scan }));
import { POST as avatar } from "@/app/api/profile/avatar/route";
import { POST as portfolio } from "@/app/api/profile/portfolio/[id]/media/route";
import { POST as proof } from "@/app/api/proofs/[id]/files/route";
import { POST as dispute } from "@/app/api/disputes/[id]/evidence/route";
import { POST as support } from "@/app/api/support/tickets/[id]/attachments/route";
import { storePrivateFile } from "./storage";
import { UPLOADS_UNAVAILABLE_MESSAGE } from "@/features/files/upload-policy";

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("FILE_UPLOADS_ENABLED", "false");
  vi.stubEnv("APP_URL", "https://beta.example");
});
afterEach(() => vi.unstubAllEnvs());

describe("disabled uploads reject before parsing, database or providers", () => {
  it.each([avatar, portfolio, proof, dispute, support])(
    "blocks an upload API without touching existing records",
    async (route) => {
      const request = new Request("https://beta.example/api/upload", {
        method: "POST",
        headers: {
          origin: "https://beta.example",
          "content-type": "multipart/form-data; boundary=unused",
        },
        body: "deliberately not a valid multipart body",
      });
      const parse = vi.spyOn(request, "formData");
      const response = await route(request, { params: Promise.resolve({ id: "existing-record" }) });
      expect(response.status).toBe(503);
      expect((await response.json()).error).toMatchObject({
        code: "FILE_UPLOADS_DISABLED",
        message: UPLOADS_UNAVAILABLE_MESSAGE,
      });
      expect(parse).not.toHaveBeenCalled();
      expect(mocks.db).not.toHaveBeenCalled();
      expect(mocks.storage).not.toHaveBeenCalled();
      expect(mocks.scan).not.toHaveBeenCalled();
    },
  );
  it("guards the shared storage entry point before resolving the backend", async () => {
    await expect(storePrivateFile(new File(["example"], "proof.txt"))).rejects.toMatchObject({
      code: "FILE_UPLOADS_DISABLED",
    });
    expect(mocks.storage).not.toHaveBeenCalled();
    expect(mocks.scan).not.toHaveBeenCalled();
  });
  it("does not block JSON evidence notes with the upload switch", async () => {
    // Authentication is reached for the unchanged text workflow, unlike multipart.
    mocks.user.mockRejectedValue(new Error("test authentication reached"));
    await dispute(
      new Request("https://beta.example/api/disputes/id/evidence", {
        method: "POST",
        headers: { origin: "https://beta.example", "content-type": "application/json" },
        body: JSON.stringify({ note: "Text evidence remains supported." }),
      }),
      { params: Promise.resolve({ id: "existing-dispute" }) },
    );
    expect(mocks.user).toHaveBeenCalled();
  });
});
