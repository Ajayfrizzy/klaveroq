import { afterEach, describe, expect, it } from "vitest";
import { allowsLocalFileScanner, detectFileType, scanFileBytes } from "./storage";

const originalScanner = process.env.FILE_SCANNER;

afterEach(() => {
  if (originalScanner === undefined) delete process.env.FILE_SCANNER;
  else process.env.FILE_SCANNER = originalScanner;
});

describe("private file validation", () => {
  it("uses magic bytes rather than the supplied filename or MIME header", () => {
    expect(detectFileType(Buffer.from([0x89, 0x50, 0x4e, 0x47, 13, 10, 26, 10]))).toBe("image/png");
    expect(detectFileType(Buffer.from("%PDF-1.7\n"))).toBe("application/pdf");
    expect(detectFileType(Buffer.from([0x4d, 0x5a, 0x90, 0x00]))).toBeNull();
    expect(detectFileType(Buffer.from([0x61, 0x0b, 0x62]))).toBeNull();
  });

  it("quarantines the standard local malware test signature", async () => {
    process.env.FILE_SCANNER = "local";
    await expect(
      scanFileBytes(Buffer.from("X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE")),
    ).resolves.toBe("INFECTED");
    await expect(scanFileBytes(Buffer.from("ordinary text evidence"))).resolves.toBe("CLEAN");
  });

  it("does not allow the local scanner in hosted production", () => {
    expect(
      allowsLocalFileScanner({
        NODE_ENV: "production",
        FILE_SCANNER: "local",
        E2E_TEST_MODE: "1",
        DATABASE_URL: "postgresql://user:secret@db.example.com/klaveroq_test",
      }),
    ).toBe(false);
    expect(
      allowsLocalFileScanner({
        NODE_ENV: "production",
        FILE_SCANNER: "local",
        DATABASE_URL: "postgresql://user:secret@127.0.0.1:55434/klaveroq_test",
      }),
    ).toBe(false);
  });

  it("allows the local scanner only for the disposable production-build harness", () => {
    expect(
      allowsLocalFileScanner({
        NODE_ENV: "production",
        FILE_SCANNER: "local",
        E2E_TEST_MODE: "1",
        DATABASE_URL: "postgresql://user:secret@127.0.0.1:55434/klaveroq_test",
      }),
    ).toBe(true);
  });
});
