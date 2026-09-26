import {
  ClientPublicMainnet,
  ClientPublicTestnet,
  Signer,
  SignerCkbPublicKey,
  SignerSignType,
  Signature,
} from "@ckb-ccc/core";

export async function verifyCkbWallet(input: {
  message: string;
  signature: string;
  publicKey: string;
  address: string;
  network: "mainnet" | "testnet";
}) {
  try {
    const signature = new Signature(input.signature, input.publicKey, SignerSignType.CkbSecp256k1);
    if (!(await Signer.verifyMessage(input.message, signature))) return false;
    const client =
      input.network === "mainnet" ? new ClientPublicMainnet() : new ClientPublicTestnet();
    const signer = new SignerCkbPublicKey(client, input.publicKey);
    return (await signer.getRecommendedAddress()) === input.address;
  } catch {
    return false;
  }
}
