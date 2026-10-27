import { ccc } from "@ckb-ccc/core";
import { listDidCkbsByLock, resolveDidCkb } from "@ckb-ccc/did-ckb";

export type VellumIdentityOption = {
  did: string;
  displayName?: string;
  walletId: string;
};

type VellumEnvironment = Record<string, string | undefined>;

type VerifiedWallet = {
  id: string;
  address: string;
  network: string;
};

type ResolvedIdentity = {
  did: string;
  cell: { cellOutput: { lock: ccc.ScriptLike } };
  data: { value: { document: unknown } };
};

export class VellumIdentityError extends Error {
  constructor(
    public code:
      "network_unavailable" | "identity_inactive" | "identity_not_controlled" | "wallet_invalid",
    message: string,
  ) {
    super(message);
  }
}

export function vellumClient(environment: VellumEnvironment = process.env): ccc.Client {
  if (environment.CKB_NETWORK !== "testnet") {
    throw new VellumIdentityError(
      "network_unavailable",
      "Vellum identities are available on CKB Testnet only.",
    );
  }

  const configured = environment.CKB_RPC_URL?.trim();
  if (!configured) {
    throw new VellumIdentityError("network_unavailable", "The CKB RPC URL is not configured.");
  }
  let url: URL;
  try {
    url = new URL(configured);
  } catch {
    throw new VellumIdentityError("network_unavailable", "The CKB RPC URL is invalid.");
  }
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) {
    throw new VellumIdentityError("network_unavailable", "The CKB RPC URL is invalid.");
  }

  return new ccc.ClientPublicTestnet({ url: url.toString(), fallbacks: [], timeout: 10_000 });
}

export function displayNameFromDocument(document: unknown): string | undefined {
  if (!document || typeof document !== "object" || Array.isArray(document)) return undefined;
  const services = (document as Record<string, unknown>).services;
  if (!services || typeof services !== "object" || Array.isArray(services)) return undefined;
  const profile = (services as Record<string, unknown>).profile;
  if (!profile || typeof profile !== "object" || Array.isArray(profile)) return undefined;
  const entry = profile as Record<string, unknown>;
  if (entry.type !== "VellumProfile" || typeof entry.displayName !== "string") return undefined;
  const displayName = entry.displayName.trim();
  if (
    !displayName ||
    displayName.length > 160 ||
    [...displayName].some((character) => {
      const code = character.codePointAt(0)!;
      return code <= 0x1f || code === 0x7f;
    })
  ) {
    return undefined;
  }
  return displayName;
}

export function identityFromRecord(
  record: ResolvedIdentity,
  walletId: string,
  expectedController: ccc.ScriptLike,
): VellumIdentityOption {
  if (!ccc.Script.from(record.cell.cellOutput.lock).eq(ccc.Script.from(expectedController))) {
    throw new VellumIdentityError(
      "identity_not_controlled",
      "The selected did:ckb identity is not controlled by this verified wallet.",
    );
  }
  return {
    did: record.did,
    displayName: displayNameFromDocument(record.data.value.document),
    walletId,
  };
}

async function walletLock(client: ccc.Client, wallet: VerifiedWallet): Promise<ccc.Script> {
  if (wallet.network !== "testnet") {
    throw new VellumIdentityError(
      "wallet_invalid",
      "The selected wallet is not a CKB Testnet wallet.",
    );
  }
  try {
    return (await ccc.Address.fromString(wallet.address, client)).script;
  } catch {
    throw new VellumIdentityError(
      "wallet_invalid",
      "The selected wallet address is invalid for CKB Testnet.",
    );
  }
}

export async function resolveControlledIdentity(
  client: ccc.Client,
  wallet: VerifiedWallet,
  did: string,
): Promise<VellumIdentityOption> {
  const lock = await walletLock(client, wallet);
  const record = await resolveDidCkb({ client, did });
  if (!record) {
    throw new VellumIdentityError(
      "identity_inactive",
      "The selected did:ckb identity is not active.",
    );
  }
  return identityFromRecord(record, wallet.id, lock);
}

export async function listControlledIdentities(
  client: ccc.Client,
  wallets: VerifiedWallet[],
): Promise<VellumIdentityOption[]> {
  const identities = await Promise.all(
    wallets.map(async (wallet) => {
      const lock = await walletLock(client, wallet);
      const records = await listDidCkbsByLock({ client, lock });
      return records.map((record) => ({
        did: record.did,
        displayName: displayNameFromDocument(record.data.value.document),
        walletId: wallet.id,
      }));
    }),
  );

  const unique = new Map<string, VellumIdentityOption>();
  for (const identity of identities.flat()) {
    if (!unique.has(identity.did)) unique.set(identity.did, identity);
  }
  return [...unique.values()].sort((left, right) => left.did.localeCompare(right.did));
}
