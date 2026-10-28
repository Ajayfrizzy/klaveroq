import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/server/db";
import {
  vellumClaimIssuances,
  vellumIssuerLeases,
  type VellumSettlementClaimPayload,
} from "@/server/db/schema";

export type SettlementClaimStatus =
  "PREPARING" | "PREPARED" | "SUBMITTED" | "CONFIRMED" | "REVIEW_REQUIRED";

export type SettlementClaimIssuance = {
  id: string;
  milestoneId: string;
  settlementOperationId: string;
  subjectDid: string;
  issuerDid: string;
  payload: VellumSettlementClaimPayload;
  issuedAt: Date;
  status: SettlementClaimStatus;
  leaseToken: string;
  claimId: string | null;
  outputIndex: number | null;
  signedTransaction: string | null;
  transactionHash: string | null;
  lastErrorCode: string | null;
  confirmedAt: Date | null;
  revision: number;
  createdAt: Date;
  updatedAt: Date;
};

export type SettlementIssuerLease = {
  key: string;
  token: string;
  issuanceId: string | null;
  transactionHash: string | null;
  expiresAt: Date;
  revision: number;
  createdAt: Date;
  updatedAt: Date;
};

export type NewSettlementClaimIssuance = Pick<
  SettlementClaimIssuance,
  | "issuerDid"
  | "issuedAt"
  | "leaseToken"
  | "milestoneId"
  | "payload"
  | "settlementOperationId"
  | "subjectDid"
>;

export type SettlementClaimIssuanceChanges = Partial<
  Pick<
    SettlementClaimIssuance,
    | "claimId"
    | "confirmedAt"
    | "lastErrorCode"
    | "leaseToken"
    | "outputIndex"
    | "signedTransaction"
    | "status"
    | "transactionHash"
  >
>;

export type SettlementIssuerLeaseChanges = Partial<
  Pick<SettlementIssuerLease, "expiresAt" | "issuanceId" | "token" | "transactionHash">
>;

export interface SettlementClaimStore {
  createIssuance(input: NewSettlementClaimIssuance): Promise<SettlementClaimIssuance | null>;
  createLease(input: {
    expiresAt: Date;
    key: string;
    token: string;
  }): Promise<SettlementIssuerLease | null>;
  deleteLease(key: string, revision: number, token: string): Promise<boolean>;
  getActiveIssuance(): Promise<SettlementClaimIssuance | null>;
  getIssuance(id: string): Promise<SettlementClaimIssuance | null>;
  getIssuanceByMilestone(milestoneId: string): Promise<SettlementClaimIssuance | null>;
  getLease(key: string): Promise<SettlementIssuerLease | null>;
  updateIssuance(
    id: string,
    revision: number,
    changes: SettlementClaimIssuanceChanges,
  ): Promise<SettlementClaimIssuance | null>;
  updateLease(
    key: string,
    revision: number,
    token: string,
    changes: SettlementIssuerLeaseChanges,
  ): Promise<SettlementIssuerLease | null>;
}

export class DatabaseSettlementClaimStore implements SettlementClaimStore {
  async createIssuance(input: NewSettlementClaimIssuance): Promise<SettlementClaimIssuance | null> {
    const [created] = await db
      .insert(vellumClaimIssuances)
      .values(input)
      .onConflictDoNothing()
      .returning();
    return created ?? null;
  }

  async getIssuance(id: string): Promise<SettlementClaimIssuance | null> {
    const [record] = await db
      .select()
      .from(vellumClaimIssuances)
      .where(eq(vellumClaimIssuances.id, id))
      .limit(1);
    return record ?? null;
  }

  async getIssuanceByMilestone(milestoneId: string): Promise<SettlementClaimIssuance | null> {
    const [record] = await db
      .select()
      .from(vellumClaimIssuances)
      .where(eq(vellumClaimIssuances.milestoneId, milestoneId))
      .limit(1);
    return record ?? null;
  }

  async getActiveIssuance(): Promise<SettlementClaimIssuance | null> {
    const [record] = await db
      .select()
      .from(vellumClaimIssuances)
      .where(inArray(vellumClaimIssuances.status, ["PREPARING", "PREPARED", "SUBMITTED"]))
      .orderBy(asc(vellumClaimIssuances.createdAt), asc(vellumClaimIssuances.id))
      .limit(1);
    return record ?? null;
  }

  async updateIssuance(
    id: string,
    revision: number,
    changes: SettlementClaimIssuanceChanges,
  ): Promise<SettlementClaimIssuance | null> {
    const [updated] = await db
      .update(vellumClaimIssuances)
      .set({
        ...changes,
        revision: sql`${vellumClaimIssuances.revision} + 1`,
        updatedAt: new Date(),
      })
      .where(and(eq(vellumClaimIssuances.id, id), eq(vellumClaimIssuances.revision, revision)))
      .returning();
    return updated ?? null;
  }

  async createLease(input: {
    expiresAt: Date;
    key: string;
    token: string;
  }): Promise<SettlementIssuerLease | null> {
    const [created] = await db
      .insert(vellumIssuerLeases)
      .values(input)
      .onConflictDoNothing()
      .returning();
    return created ?? null;
  }

  async getLease(key: string): Promise<SettlementIssuerLease | null> {
    const [record] = await db
      .select()
      .from(vellumIssuerLeases)
      .where(eq(vellumIssuerLeases.key, key))
      .limit(1);
    return record ?? null;
  }

  async updateLease(
    key: string,
    revision: number,
    token: string,
    changes: SettlementIssuerLeaseChanges,
  ): Promise<SettlementIssuerLease | null> {
    const [updated] = await db
      .update(vellumIssuerLeases)
      .set({
        ...changes,
        revision: sql`${vellumIssuerLeases.revision} + 1`,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(vellumIssuerLeases.key, key),
          eq(vellumIssuerLeases.revision, revision),
          eq(vellumIssuerLeases.token, token),
        ),
      )
      .returning();
    return updated ?? null;
  }

  async deleteLease(key: string, revision: number, token: string): Promise<boolean> {
    const deleted = await db
      .delete(vellumIssuerLeases)
      .where(
        and(
          eq(vellumIssuerLeases.key, key),
          eq(vellumIssuerLeases.revision, revision),
          eq(vellumIssuerLeases.token, token),
        ),
      )
      .returning({ key: vellumIssuerLeases.key });
    return deleted.length === 1;
  }
}
