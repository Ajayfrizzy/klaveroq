import { randomInt } from "node:crypto";

export function createJobReference() {
  return `KQ-${Date.now().toString(36).toUpperCase()}${randomInt(100, 999)}`;
}

export function createDisputeReference() {
  return `KQ-D-${randomInt(100000, 999999)}`;
}

export function createSupportReference() {
  return `KQ-S-${randomInt(100000, 999999)}`;
}
