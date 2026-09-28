import net from "node:net";
import { spawn } from "node:child_process";

// Run only inside the isolated Playwright Linux container. Keep the app's loopback
// origin and test-database URLs unchanged while forwarding to the host harness.
if (process.platform !== "linux")
  throw new Error("This helper is for the Linux browser container.");
const servers = [3199, 3201, 55434].map((port) => {
  const server = net.createServer((socket) => {
    const upstream = net.connect(port, "host.docker.internal");
    socket.pipe(upstream).pipe(socket);
    socket.on("error", () => upstream.destroy());
    upstream.on("error", () => socket.destroy());
    socket.on("close", () => upstream.destroy());
  });
  return server.listen(port, "127.0.0.1");
});
const runner = spawn("node", ["scripts/run-playwright.mjs", ...process.argv.slice(2)], {
  stdio: "inherit",
  env: { ...process.env, PLAYWRIGHT_EXTERNAL_SERVER: "1" },
});
runner.on("exit", (code) => {
  servers.forEach((server) => server.close());
  process.exit(code ?? 1);
});
