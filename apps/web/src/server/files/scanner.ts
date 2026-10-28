import { createConnection } from "node:net";
import { ApiError } from "../http/errors";
type FileScannerEnvironment = Record<string, string | undefined>;

export function allowsLocalFileScanner(environment: FileScannerEnvironment = process.env) {
  if (environment.NODE_ENV !== "production") return true;
  if (environment.E2E_TEST_MODE !== "1" || !environment.DATABASE_URL) return false;
  try {
    const database = new URL(environment.DATABASE_URL);
    return (
      ["127.0.0.1", "localhost", "::1"].includes(database.hostname) &&
      database.pathname.slice(1).endsWith("_test")
    );
  } catch {
    return false;
  }
}

async function scanWithClamAv(bytes: Buffer) {
  const host = process.env.CLAMAV_HOST;
  const port = Number(process.env.CLAMAV_PORT ?? 3310);
  if (!host || !Number.isInteger(port) || port < 1 || port > 65535)
    throw new ApiError(503, "FILE_SCANNER_UNAVAILABLE", "File scanning is not configured.");
  return new Promise<"CLEAN" | "INFECTED">((resolvePromise, reject) => {
    const socket = createConnection({ host, port });
    let response = "";
    let settled = false;
    const finish = (error?: Error, result?: "CLEAN" | "INFECTED") => {
      if (settled) return;
      settled = true;
      clearTimeout(deadline);
      socket.destroy();
      if (error) reject(error);
      else resolvePromise(result!);
    };
    const deadline = setTimeout(() => finish(new Error("File scanner timed out.")), 30_000);
    socket.setTimeout(10_000, () => finish(new Error("File scanner timed out.")));
    socket.on("error", (error) => finish(error));
    socket.on("close", () => finish(new Error("File scanner closed without a verdict.")));
    socket.on("connect", () => {
      // Write one frame at a time to respect backpressure on the private network.
      let offset = 0;
      const writeNext = () => {
        if (settled) return;
        if (offset >= bytes.length) {
          socket.write(Buffer.alloc(4));
          return;
        }
        const chunk = bytes.subarray(offset, offset + 64 * 1024);
        offset += chunk.length;
        const size = Buffer.alloc(4);
        size.writeUInt32BE(chunk.length);
        socket.write(Buffer.concat([size, chunk]), (error) => {
          if (error) finish(error);
          else writeNext();
        });
      };
      socket.write("zINSTREAM\0", (error) => {
        if (error) finish(error);
        else writeNext();
      });
    });
    socket.on("data", (chunk: Buffer) => {
      response += chunk.toString("utf8");
      if (response.length > 4096) return finish(new Error("File scanner response is too large."));
      if (!response.includes("\0")) return;
      // Only accept the complete INSTREAM verdict, not a substring of an error.
      if (response === "stream: OK\0") finish(undefined, "CLEAN");
      else if (/^stream: [^\r\n\0]+ FOUND\0$/.test(response)) finish(undefined, "INFECTED");
      else finish(new Error("File scanner returned an invalid response."));
    });
    socket.on("end", () => finish(new Error("File scanner ended without a verdict.")));
  });
}

export async function scanFileBytes(bytes: Buffer) {
  const scanner =
    process.env.FILE_SCANNER ?? (process.env.NODE_ENV === "production" ? "" : "local");
  if (scanner === "local" && allowsLocalFileScanner())
    return bytes.toString("ascii").includes("EICAR-STANDARD-ANTIVIRUS-TEST-FILE")
      ? ("INFECTED" as const)
      : ("CLEAN" as const);
  if (scanner === "clamav") return scanWithClamAv(bytes);
  throw new ApiError(503, "FILE_SCANNER_UNAVAILABLE", "File scanning is not configured.");
}
