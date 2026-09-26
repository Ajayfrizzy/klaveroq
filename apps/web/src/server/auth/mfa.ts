import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";
import { and, eq, isNull, sql } from "drizzle-orm";
import { db } from "../db";
import { mfaLoginChallenges, mfaMethods } from "../db/schema";
import { ApiError } from "../http/errors";
import { randomToken, sha256 } from "../http/security";

const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function base32Encode(bytes: Uint8Array) {
  let bits = 0;
  let value = 0;
  let output = "";
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += alphabet[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) output += alphabet[(value << (5 - bits)) & 31];
  return output;
}

function base32Decode(value: string) {
  let bits = 0;
  let buffer = 0;
  const output: number[] = [];
  for (const character of value.replaceAll("=", "").toUpperCase()) {
    const index = alphabet.indexOf(character);
    if (index < 0) throw new Error("Invalid base32 value.");
    buffer = (buffer << 5) | index;
    bits += 5;
    if (bits >= 8) {
      output.push((buffer >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(output);
}

function encryptionKey() {
  const configured = process.env.MFA_ENCRYPTION_KEY;
  if (configured) {
    const key = Buffer.from(configured, "base64");
    if (key.length === 32) return key;
    throw new ApiError(
      503,
      "MFA_CONFIGURATION_INVALID",
      "MFA encryption is not configured correctly.",
    );
  }
  if (process.env.NODE_ENV === "production")
    throw new ApiError(503, "MFA_NOT_CONFIGURED", "MFA encryption is not configured.");
  return createHmac("sha256", "klaveroq-local-mfa")
    .update(process.env.SESSION_SECRET ?? "local-development")
    .digest();
}

export function encryptMfaSecret(secret: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(secret, "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), ciphertext].map((part) => part.toString("base64url")).join(".");
}

export function decryptMfaSecret(value: string) {
  const [ivValue, tagValue, ciphertextValue] = value.split(".");
  if (!ivValue || !tagValue || !ciphertextValue) throw new Error("Invalid encrypted MFA secret.");
  const decipher = createDecipheriv(
    "aes-256-gcm",
    encryptionKey(),
    Buffer.from(ivValue, "base64url"),
  );
  decipher.setAuthTag(Buffer.from(tagValue, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(ciphertextValue, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}

export function generateTotpSecret() {
  return base32Encode(randomBytes(20));
}

export function totpCode(secret: string, timestamp = Date.now()) {
  const counter = Math.floor(timestamp / 30_000);
  const bytes = Buffer.alloc(8);
  bytes.writeBigUInt64BE(BigInt(counter));
  const digest = createHmac("sha1", base32Decode(secret)).update(bytes).digest();
  const offset = digest[digest.length - 1] & 15;
  const value =
    (((digest[offset] & 127) << 24) |
      (digest[offset + 1] << 16) |
      (digest[offset + 2] << 8) |
      digest[offset + 3]) %
    1_000_000;
  return value.toString().padStart(6, "0");
}

export function verifyTotp(secret: string, code: string, timestamp = Date.now()) {
  if (!/^\d{6}$/.test(code)) return false;
  return [-1, 0, 1].some((offset) => {
    const expected = totpCode(secret, timestamp + offset * 30_000);
    return timingSafeEqual(Buffer.from(expected), Buffer.from(code));
  });
}

export function generateRecoveryCodes(count = 8) {
  return Array.from({ length: count }, () => randomBytes(10).toString("hex").toUpperCase());
}

export async function activeMfaMethod(userId: string) {
  const [method] = await db
    .select()
    .from(mfaMethods)
    .where(and(eq(mfaMethods.userId, userId), isNull(mfaMethods.disabledAt)))
    .limit(1);
  return method?.verifiedAt ? method : null;
}

export async function issueMfaLoginChallenge(userId: string, returnTo?: string) {
  const token = randomToken();
  await db.insert(mfaLoginChallenges).values({
    userId,
    tokenHash: sha256(token),
    returnTo,
    expiresAt: new Date(Date.now() + 5 * 60_000),
  });
  return token;
}

export async function verifyMfaCode(method: typeof mfaMethods.$inferSelect, code: string) {
  const normalized = code.replaceAll(/[-\s]/g, "").toUpperCase();
  if (verifyTotp(decryptMfaSecret(method.secretEncrypted), normalized)) return { recovery: false };
  const hash = sha256(normalized);
  const [consumed] = await db
    .update(mfaMethods)
    .set({
      recoveryCodeHashes: sql`${mfaMethods.recoveryCodeHashes} - ${hash}`,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(mfaMethods.userId, method.userId),
        sql`${mfaMethods.recoveryCodeHashes} @> ${JSON.stringify([hash])}::jsonb`,
      ),
    )
    .returning({ userId: mfaMethods.userId });
  if (!consumed) return null;
  return { recovery: true };
}
