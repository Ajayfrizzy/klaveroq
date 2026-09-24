import { readFile, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const webRoot = path.join(repositoryRoot, "apps/web");
const generatedFiles = ["next-env.d.ts", "tsconfig.json"];
const originals = new Map(
  await Promise.all(
    generatedFiles.map(async (file) => [file, await readFile(path.join(webRoot, file), "utf8")]),
  ),
);

let status = 1;
try {
  const result = spawnSync("npx", ["playwright", "test", ...process.argv.slice(2)], {
    cwd: webRoot,
    env: process.env,
    stdio: "inherit",
  });
  status = result.status ?? 1;
} finally {
  await Promise.all(
    [...originals].map(([file, contents]) => writeFile(path.join(webRoot, file), contents)),
  );
}

process.exit(status);
