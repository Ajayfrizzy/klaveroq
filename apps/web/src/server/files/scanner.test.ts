import { EventEmitter } from "node:events";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const network = vi.hoisted(() => ({ connect: vi.fn() }));
vi.mock("node:net", () => ({ createConnection: network.connect }));
import { scanFileBytes } from "./scanner";

class ScannerSocket extends EventEmitter {
  writes: Buffer[] = [];
  destroy = vi.fn();
  setTimeout = vi.fn();
  write(data: string | Buffer, callback?: (error?: Error) => void) {
    this.writes.push(Buffer.from(data));
    queueMicrotask(() => callback?.());
    return true;
  }
}
let socket: ScannerSocket;
beforeEach(() => {
  vi.stubEnv("FILE_SCANNER", "clamav");
  vi.stubEnv("CLAMAV_HOST", "private-scanner");
  vi.stubEnv("CLAMAV_PORT", "3310");
  socket = new ScannerSocket();
  network.connect.mockReturnValue(socket);
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

describe("ClamAV INSTREAM protocol", () => {
  it("frames exact bytes in bounded chunks and accepts a fragmented complete verdict", async () => {
    const bytes = Buffer.alloc(70_000, 65);
    const result = scanFileBytes(bytes);
    socket.emit("connect");
    // Flush callbacks used for backpressure.
    await new Promise<void>((resolve) => setImmediate(resolve));
    expect(network.connect).toHaveBeenCalledWith({ host: "private-scanner", port: 3310 });
    expect(socket.writes[0].toString()).toBe("zINSTREAM\0");
    expect(socket.writes[1].readUInt32BE()).toBe(65536);
    expect(socket.writes[2].readUInt32BE()).toBe(4464);
    expect(Buffer.concat(socket.writes.slice(1, -1).map((frame) => frame.subarray(4)))).toEqual(
      bytes,
    );
    expect(socket.writes.at(-1)).toEqual(Buffer.alloc(4));
    socket.emit("data", Buffer.from("stream: O"));
    socket.emit("data", Buffer.from("K\0"));
    await expect(result).resolves.toBe("CLEAN");
    expect(socket.destroy).toHaveBeenCalled();
  });
  it("rejects EICAR with an infected verdict", async () => {
    const result = scanFileBytes(Buffer.from("EICAR"));
    socket.emit("data", Buffer.from("stream: Eicar-Test-Signature FOUND\0"));
    await expect(result).resolves.toBe("INFECTED");
  });
  it.each(["stream: size limit exceeded ERROR\0", "error OK\0", "stream: OK\0extra"])(
    "fails closed for an invalid verdict %s",
    async (response) => {
      const result = scanFileBytes(Buffer.from("evidence"));
      socket.emit("data", Buffer.from(response));
      await expect(result).rejects.toThrow("invalid response");
    },
  );
  it.each(["error", "close", "end"])("fails closed on %s without a verdict", async (event) => {
    const result = scanFileBytes(Buffer.from("evidence"));
    socket.emit(event, new Error("connection refused"));
    await expect(result).rejects.toThrow();
  });
  it("bounds the total scan time even if a connection stays open", async () => {
    vi.useFakeTimers();
    const result = scanFileBytes(Buffer.from("evidence"));
    const assertion = expect(result).rejects.toThrow("timed out");
    await vi.advanceTimersByTimeAsync(30_000);
    await assertion;
    expect(socket.destroy).toHaveBeenCalled();
  });
  it("rejects invalid ports before connecting", async () => {
    network.connect.mockClear();
    vi.stubEnv("CLAMAV_PORT", "65536");
    await expect(scanFileBytes(Buffer.from("evidence"))).rejects.toMatchObject({ status: 503 });
    expect(network.connect).not.toHaveBeenCalled();
  });
});
