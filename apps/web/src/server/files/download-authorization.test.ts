import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ requireUser: vi.fn(), rows: vi.fn(), read: vi.fn() }));
vi.mock("@/server/auth/session", () => ({ requireUser: mocks.requireUser }));
vi.mock("@/server/files/storage", () => ({ readPrivateFile: mocks.read }));
vi.mock("@/server/db", () => ({
  db: {
    select: () => {
      const query = {
        from: () => query,
        innerJoin: () => query,
        where: () => query,
        limit: mocks.rows,
      };
      return query;
    },
  },
}));
import { ApiError } from "../http/errors";
import { GET as proof } from "@/app/api/files/[id]/route";
import { GET as dispute } from "@/app/api/dispute-files/[id]/route";
import { GET as support } from "@/app/api/support/attachments/[id]/route";
import { GET as avatar } from "@/app/api/media/avatar/[userId]/route";
import { GET as portfolio } from "@/app/api/media/portfolio/[id]/route";

const request = new Request("https://beta.example/api/files/test");
const context = { params: Promise.resolve({ id: "file-id", userId: "owner" }) };
const media = {
  storageKey: "clean/2025-01-01/file.txt",
  scanStatus: "CLEAN",
  contentType: "text/plain",
  originalName: "evidence.txt",
};
beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireUser.mockResolvedValue({ user: { id: "viewer", systemRole: "USER" } });
  mocks.rows.mockResolvedValue([]);
  mocks.read.mockResolvedValue(new Uint8Array([65]));
});

describe("download authorization before storage access", () => {
  it.each([proof, dispute, support, avatar, portfolio])(
    "denies anonymous requests",
    async (route) => {
      mocks.requireUser.mockRejectedValue(new ApiError(401, "UNAUTHENTICATED", "Sign in."));
      expect((await route(request, context)).status).toBe(401);
      expect(mocks.rows).not.toHaveBeenCalled();
      expect(mocks.read).not.toHaveBeenCalled();
    },
  );
  it.each([proof, dispute])(
    "denies missing/nonparticipant records selected by the authorization query",
    async (route) => {
      expect((await route(request, context)).status).toBe(404);
      expect(mocks.read).not.toHaveBeenCalled();
    },
  );
  it.each([proof, dispute])("denies metadata without a clean verdict", async (route) => {
    mocks.rows.mockResolvedValue([{ file: { ...media, scanStatus: "PENDING" } }]);
    expect((await route(request, context)).status).toBe(404);
    expect(mocks.read).not.toHaveBeenCalled();
  });
  it("denies another user's support attachment and internal messages", async () => {
    mocks.rows.mockResolvedValue([
      { attachment: media, ticket: { userId: "owner" }, message: { internal: false } },
    ]);
    expect((await support(request, context)).status).toBe(404);
    mocks.rows.mockResolvedValue([
      { attachment: media, ticket: { userId: "viewer" }, message: { internal: true } },
    ]);
    expect((await support(request, context)).status).toBe(404);
    expect(mocks.read).not.toHaveBeenCalled();
  });
  it.each([avatar, portfolio])("denies nonowners of private media", async (route) => {
    mocks.rows.mockResolvedValue([
      { media, profile: { isPublic: false }, item: { userId: "owner" } },
    ]);
    expect((await route(request, context)).status).toBe(404);
    expect(mocks.read).not.toHaveBeenCalled();
  });
  it.each([avatar, portfolio])(
    "serves public-profile media only to authenticated viewers without public caching",
    async (route) => {
      mocks.rows.mockResolvedValue([
        { media, profile: { isPublic: true }, item: { userId: "owner" } },
      ]);
      const response = await route(request, context);
      expect(response.status).toBe(200);
      expect(response.headers.get("cache-control")).toBe("private, no-store");
      expect(mocks.read).toHaveBeenCalledWith(media.storageKey);
    },
  );
  it("serves authorized evidence through the app, not a public URL", async () => {
    mocks.rows.mockResolvedValue([{ file: media }]);
    const response = await proof(request, context);
    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
    expect(response.headers.get("cache-control")).toBe("private, no-store");
  });
});
