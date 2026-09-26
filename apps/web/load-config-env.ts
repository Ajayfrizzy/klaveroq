import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { loadEnvFile } from "node:process";

export function loadConfigEnvironment(cwd = process.cwd()) {
  const candidates = [resolve(cwd, ".env"), resolve(cwd, "../../.env")];
  const selected = candidates.find(existsSync);
  if (selected) loadEnvFile(selected);
  return selected;
}
