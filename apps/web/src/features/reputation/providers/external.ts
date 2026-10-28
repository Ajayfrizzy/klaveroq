/** Optional external signals are separate from native Klaveroq engagement history.
 * No provider is connected in community beta; this interface never participates in login.
 */
export type ExternalReputation = {
  provider: string;
  did?: `did:ckb:${string}`;
  credentials: ReadonlyArray<{ label: string; issuer: string; verifiedAt: string }>;
};
export interface ExternalReputationProvider {
  getPublishedClaims(publicProfileId: string): Promise<ExternalReputation | null>;
}
export const externalReputationProvider: ExternalReputationProvider = {
  async getPublishedClaims() {
    return null;
  },
};
