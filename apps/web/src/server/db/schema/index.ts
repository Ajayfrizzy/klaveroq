import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
};

export const accountStatusEnum = pgEnum("account_status", [
  "PENDING_EMAIL_VERIFICATION",
  "ACTIVE",
  "RESTRICTED",
  "SECURITY_REVIEW",
  "SUSPENDED",
  "CLOSED",
]);
export const identityStatusEnum = pgEnum("identity_status", [
  "NOT_STARTED",
  "PENDING",
  "VERIFIED",
  "REJECTED",
  "REVIEW_REQUIRED",
  "EXPIRED",
]);
export const walletPurposeEnum = pgEnum("wallet_purpose", ["FUNDING", "PAYOUT", "BOTH"]);
export const walletStatusEnum = pgEnum("wallet_status", [
  "PENDING",
  "VERIFIED",
  "REPLACED",
  "LOCKED",
  "REVOKED",
]);
export const agreementStatusEnum = pgEnum("agreement_status", [
  "DRAFT",
  "INVITED",
  "AWAITING_FUNDING",
  "FUNDED_AWAITING_ACCEPTANCE",
  "ACCEPTED",
  "IN_PROGRESS",
  "COMPLETED",
  "DECLINED",
  "EXPIRED",
  "CANCELLATION_PENDING",
  "CANCELLED",
  "DISPUTED",
  "SECURITY_HOLD",
  "REFUND_PENDING",
  "REFUNDED",
  "FAILED",
]);
export const milestoneStatusEnum = pgEnum("milestone_status", [
  "PENDING",
  "ACTIVE",
  "PROOF_SUBMITTED",
  "UNDER_REVIEW",
  "REVISION_REQUESTED",
  "APPROVED",
  "RELEASE_PENDING",
  "RELEASED",
  "DISPUTED",
  "SECURITY_HOLD",
  "REFUND_PENDING",
  "REFUNDED",
  "CANCELLED",
  "FAILED",
]);
export const operationStatusEnum = pgEnum("operation_status", [
  "PENDING",
  "PROCESSING",
  "CONFIRMED",
  "FAILED",
  "SECURITY_HOLD",
  "CANCELLED",
]);
export const disputeStatusEnum = pgEnum("dispute_status", [
  "OPEN",
  "EVIDENCE_COLLECTION",
  "UNDER_REVIEW",
  "RESOLVED",
  "APPEALED",
  "CLOSED",
]);
export const supportTicketStatusEnum = pgEnum("support_ticket_status", [
  "OPEN",
  "IN_PROGRESS",
  "WAITING_FOR_USER",
  "RESOLVED",
  "CLOSED",
]);
export const supportTicketPriorityEnum = pgEnum("support_ticket_priority", [
  "LOW",
  "NORMAL",
  "HIGH",
  "URGENT",
]);
export const supportTicketCategoryEnum = pgEnum("support_ticket_category", [
  "JOB",
  "PAYMENT",
  "WALLET",
  "SECURITY",
  "DISPUTE",
  "GENERAL",
]);
export const supportSenderTypeEnum = pgEnum("support_sender_type", ["USER", "SUPPORT", "SYSTEM"]);
export const systemRoleEnum = pgEnum("system_role", [
  "USER",
  "SUPPORT",
  "DISPUTE_ADMIN",
  "RISK_ADMIN",
  "SUPER_ADMIN",
]);
export const jobCategoryEnum = pgEnum("job_category", [
  "DESIGN",
  "DEVELOPMENT",
  "WRITING",
  "MARKETING",
  "DATA",
  "ADMIN",
  "OTHER",
]);
export const jobListingStatusEnum = pgEnum("job_listing_status", [
  "DRAFT",
  "OPEN",
  "CLOSED",
  "AWARDED",
  "CANCELLED",
]);
export const proposalStatusEnum = pgEnum("proposal_status", [
  "SUBMITTED",
  "WITHDRAWN",
  "REJECTED",
  "ACCEPTED",
]);
export const availabilityStatusEnum = pgEnum("availability_status", [
  "AVAILABLE",
  "LIMITED",
  "UNAVAILABLE",
]);

export const users = pgTable(
  "users",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    email: varchar("email", { length: 320 }).notNull(),
    passwordHash: text("password_hash"),
    emailVerifiedAt: timestamp("email_verified_at", { withTimezone: true }),
    status: accountStatusEnum("status").default("PENDING_EMAIL_VERIFICATION").notNull(),
    systemRole: systemRoleEnum("system_role").default("USER").notNull(),
    failedLoginCount: integer("failed_login_count").default(0).notNull(),
    lockedUntil: timestamp("locked_until", { withTimezone: true }),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [uniqueIndex("users_email_unique").on(sql`lower(${table.email})`)],
);

export const profiles = pgTable(
  "profiles",
  {
    userId: uuid("user_id")
      .primaryKey()
      .references(() => users.id, { onDelete: "cascade" }),
    displayName: varchar("display_name", { length: 100 }).notNull(),
    headline: varchar("headline", { length: 160 }),
    bio: text("bio"),
    primaryRole: varchar("primary_role", { length: 100 }),
    skills: jsonb("skills").$type<string[]>().default([]).notNull(),
    experienceLevel: varchar("experience_level", { length: 30 }),
    yearsExperience: integer("years_experience"),
    languages: jsonb("languages").$type<string[]>().default([]).notNull(),
    availability: availabilityStatusEnum("availability").default("AVAILABLE").notNull(),
    preferredWorkCategories: jsonb("preferred_work_categories")
      .$type<string[]>()
      .default([])
      .notNull(),
    countryCode: varchar("country_code", { length: 2 }),
    timezone: varchar("timezone", { length: 80 }),
    avatarKey: text("avatar_key"),
    githubUrl: text("github_url"),
    websiteUrl: text("website_url"),
    linkedinUrl: text("linkedin_url"),
    isPublic: boolean("is_public").default(false).notNull(),
    ...timestamps,
  },
  (table) => [
    index("profiles_talent_role_idx").on(table.primaryRole),
    index("profiles_talent_availability_idx").on(table.availability),
    index("profiles_talent_country_idx").on(table.countryCode),
    index("profiles_public_updated_idx").on(table.isPublic, table.updatedAt, table.userId),
    index("profiles_skills_gin_idx").using("gin", table.skills),
    index("profiles_categories_gin_idx").using("gin", table.preferredWorkCategories),
    check(
      "profiles_years_experience_valid",
      sql`${table.yearsExperience} IS NULL OR ${table.yearsExperience} BETWEEN 0 AND 80`,
    ),
  ],
);

export const portfolioItems = pgTable(
  "portfolio_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: varchar("title", { length: 140 }).notNull(),
    description: text("description").notNull(),
    projectUrl: text("project_url"),
    githubUrl: text("github_url"),
    mediaKey: text("media_key"),
    skills: jsonb("skills").$type<string[]>().default([]).notNull(),
    projectRole: varchar("project_role", { length: 120 }),
    ...timestamps,
  },
  (table) => [
    index("portfolio_items_user_idx").on(table.userId, table.createdAt),
    index("portfolio_items_skills_gin_idx").using("gin", table.skills),
  ],
);

export const mediaFiles = pgTable(
  "media_files",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    ownerUserId: uuid("owner_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    kind: varchar("kind", { length: 30 }).notNull(),
    storageKey: text("storage_key").notNull(),
    originalName: varchar("original_name", { length: 255 }).notNull(),
    contentType: varchar("content_type", { length: 120 }).notNull(),
    sizeBytes: bigint("size_bytes", { mode: "number" }).notNull(),
    sha256: varchar("sha256", { length: 64 }).notNull(),
    scanStatus: varchar("scan_status", { length: 30 }).default("PENDING").notNull(),
    altText: varchar("alt_text", { length: 500 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("media_file_storage_key_unique").on(table.storageKey),
    index("media_file_owner_idx").on(table.ownerUserId, table.createdAt),
    check("media_file_size_valid", sql`${table.sizeBytes} > 0 AND ${table.sizeBytes} <= 26214400`),
  ],
);

export const authIdentities = pgTable(
  "auth_identities",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    provider: varchar("provider", { length: 30 }).notNull(),
    providerSubject: varchar("provider_subject", { length: 255 }).notNull(),
    providerEmail: varchar("provider_email", { length: 320 }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("auth_identity_provider_subject_unique").on(table.provider, table.providerSubject),
    index("auth_identity_user_idx").on(table.userId),
  ],
);

export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: varchar("token_hash", { length: 64 }).notNull(),
    userAgent: text("user_agent"),
    ipHash: varchar("ip_hash", { length: 64 }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).defaultNow().notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("sessions_token_hash_unique").on(table.tokenHash),
    index("sessions_user_idx").on(table.userId),
  ],
);

export const verificationTokens = pgTable(
  "verification_tokens",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    purpose: varchar("purpose", { length: 32 }).notNull(),
    tokenHash: varchar("token_hash", { length: 64 }).notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    consumedAt: timestamp("consumed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [uniqueIndex("verification_token_hash_unique").on(table.tokenHash)],
);

export const authRateLimits = pgTable(
  "auth_rate_limits",
  {
    action: varchar("action", { length: 40 }).notNull(),
    keyHash: varchar("key_hash", { length: 64 }).notNull(),
    windowStartedAt: timestamp("window_started_at", { withTimezone: true }).defaultNow().notNull(),
    attempts: integer("attempts").default(1).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [primaryKey({ columns: [table.action, table.keyHash] })],
);

export const mfaMethods = pgTable("mfa_methods", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  secretEncrypted: text("secret_encrypted").notNull(),
  recoveryCodeHashes: jsonb("recovery_code_hashes").$type<string[]>().default([]).notNull(),
  verifiedAt: timestamp("verified_at", { withTimezone: true }),
  disabledAt: timestamp("disabled_at", { withTimezone: true }),
  ...timestamps,
});

export const mfaLoginChallenges = pgTable(
  "mfa_login_challenges",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: varchar("token_hash", { length: 64 }).notNull(),
    returnTo: text("return_to"),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    consumedAt: timestamp("consumed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("mfa_login_challenge_token_unique").on(table.tokenHash),
    index("mfa_login_challenge_user_idx").on(table.userId),
  ],
);

export const identityVerifications = pgTable(
  "identity_verifications",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tier: integer("tier").default(1).notNull(),
    provider: varchar("provider", { length: 50 }).notNull(),
    providerReference: varchar("provider_reference", { length: 160 }),
    status: identityStatusEnum("status").default("NOT_STARTED").notNull(),
    countryCode: varchar("country_code", { length: 2 }),
    riskLevel: varchar("risk_level", { length: 20 }),
    verifiedAt: timestamp("verified_at", { withTimezone: true }),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    metadata: jsonb("metadata").default({}).notNull(),
    ...timestamps,
  },
  (table) => [index("identity_user_idx").on(table.userId)],
);

export const wallets = pgTable(
  "wallets",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    network: varchar("network", { length: 30 }).notNull(),
    address: varchar("address", { length: 300 }).notNull(),
    purpose: walletPurposeEnum("purpose").notNull(),
    status: walletStatusEnum("status").default("PENDING").notNull(),
    isDefaultFunding: boolean("is_default_funding").default(false).notNull(),
    isDefaultPayout: boolean("is_default_payout").default(false).notNull(),
    verifiedAt: timestamp("verified_at", { withTimezone: true }),
    replacedAt: timestamp("replaced_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("wallet_user_network_address_unique").on(
      table.userId,
      table.network,
      table.address,
    ),
    index("wallet_user_idx").on(table.userId),
  ],
);

export const walletChallenges = pgTable(
  "wallet_challenges",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    network: varchar("network", { length: 30 }).notNull(),
    address: varchar("address", { length: 300 }).notNull(),
    nonceHash: varchar("nonce_hash", { length: 64 }).notNull(),
    message: text("message").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    consumedAt: timestamp("consumed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [uniqueIndex("wallet_challenge_nonce_unique").on(table.nonceHash)],
);

export const securityHolds = pgTable("security_holds", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id),
  jobId: uuid("job_id"),
  type: varchar("type", { length: 50 }).notNull(),
  reason: text("reason").notNull(),
  startsAt: timestamp("starts_at", { withTimezone: true }).defaultNow().notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  releasedAt: timestamp("released_at", { withTimezone: true }),
  releasedBy: uuid("released_by").references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const jobs = pgTable(
  "jobs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    reference: varchar("reference", { length: 30 }).notNull(),
    clientUserId: uuid("client_user_id")
      .notNull()
      .references(() => users.id),
    workerUserId: uuid("worker_user_id").references(() => users.id),
    workerEmail: varchar("worker_email", { length: 320 }).notNull(),
    title: varchar("title", { length: 90 }).notNull(),
    description: text("description").notNull(),
    asset: varchar("asset", { length: 30 }).default("CKB").notNull(),
    assetDecimals: integer("asset_decimals").default(8).notNull(),
    subtotal: bigint("subtotal", { mode: "bigint" }).notNull(),
    clientFee: bigint("client_fee", { mode: "bigint" }).notNull(),
    workerFeeBps: integer("worker_fee_bps").default(200).notNull(),
    networkReserve: bigint("network_reserve", { mode: "bigint" }).notNull(),
    status: agreementStatusEnum("status").default("DRAFT").notNull(),
    acceptanceExpiresAt: timestamp("acceptance_expires_at", { withTimezone: true }),
    fundedAt: timestamp("funded_at", { withTimezone: true }),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    externalAgreementId: varchar("external_agreement_id", { length: 160 }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("jobs_reference_unique").on(table.reference),
    index("jobs_client_idx").on(table.clientUserId),
    index("jobs_worker_idx").on(table.workerUserId),
    index("jobs_worker_status_idx").on(table.workerUserId, table.status),
    check(
      "jobs_amounts_nonnegative",
      sql`${table.subtotal} >= 0 AND ${table.clientFee} >= 0 AND ${table.networkReserve} >= 0`,
    ),
    check("jobs_worker_fee_valid", sql`${table.workerFeeBps} BETWEEN 0 AND 10000`),
  ],
);

export const milestones = pgTable(
  "milestones",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    jobId: uuid("job_id")
      .notNull()
      .references(() => jobs.id, { onDelete: "cascade" }),
    sequence: integer("sequence").notNull(),
    title: varchar("title", { length: 120 }).notNull(),
    description: text("description").notNull(),
    acceptanceCriteria: text("acceptance_criteria").default("").notNull(),
    amount: bigint("amount", { mode: "bigint" }).notNull(),
    dueAt: timestamp("due_at", { withTimezone: true }).notNull(),
    evidenceRequirements: text("evidence_requirements").notNull(),
    status: milestoneStatusEnum("status").default("PENDING").notNull(),
    reviewPeriodDays: integer("review_period_days").default(5).notNull(),
    revisionCount: integer("revision_count").default(0).notNull(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("milestone_job_sequence_unique").on(table.jobId, table.sequence),
    check("milestone_amount_positive", sql`${table.amount} > 0`),
    check("milestone_review_days_valid", sql`${table.reviewPeriodDays} BETWEEN 1 AND 30`),
  ],
);

export const jobPayoutDestinations = pgTable(
  "job_payout_destinations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    jobId: uuid("job_id")
      .notNull()
      .references(() => jobs.id),
    workerUserId: uuid("worker_user_id")
      .notNull()
      .references(() => users.id),
    walletId: uuid("wallet_id")
      .notNull()
      .references(() => wallets.id),
    network: varchar("network", { length: 30 }).notNull(),
    address: varchar("address", { length: 300 }).notNull(),
    capturedAt: timestamp("captured_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [uniqueIndex("job_payout_destination_unique").on(table.jobId)],
);

export const feeQuotes = pgTable("fee_quotes", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id),
  asset: varchar("asset", { length: 30 }).notNull(),
  subtotal: bigint("subtotal", { mode: "bigint" }).notNull(),
  clientFee: bigint("client_fee", { mode: "bigint" }).notNull(),
  workerFee: bigint("worker_fee", { mode: "bigint" }).notNull(),
  networkReserve: bigint("network_reserve", { mode: "bigint" }).notNull(),
  totalFunding: bigint("total_funding", { mode: "bigint" }).notNull(),
  workerNet: bigint("worker_net", { mode: "bigint" }).notNull(),
  policyVersion: varchar("policy_version", { length: 30 }).notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const jobListings = pgTable(
  "job_listings",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    clientUserId: uuid("client_user_id")
      .notNull()
      .references(() => users.id),
    title: varchar("title", { length: 90 }).notNull(),
    description: text("description").notNull(),
    category: jobCategoryEnum("category").notNull(),
    skills: jsonb("skills").$type<string[]>().default([]).notNull(),
    asset: varchar("asset", { length: 30 }).default("CKB").notNull(),
    assetDecimals: integer("asset_decimals").default(8).notNull(),
    budgetMin: bigint("budget_min", { mode: "bigint" }).notNull(),
    budgetMax: bigint("budget_max", { mode: "bigint" }).notNull(),
    proposalDeadline: timestamp("proposal_deadline", { withTimezone: true }).notNull(),
    status: jobListingStatusEnum("status").default("DRAFT").notNull(),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    closedAt: timestamp("closed_at", { withTimezone: true }),
    awardedJobId: uuid("awarded_job_id").references(() => jobs.id),
    ...timestamps,
  },
  (table) => [
    index("job_listings_client_idx").on(table.clientUserId),
    index("job_listings_discovery_idx").on(table.status, table.publishedAt, table.id),
    index("job_listings_budget_discovery_idx").on(table.status, table.budgetMax, table.id),
    check(
      "job_listing_budget_valid",
      sql`${table.budgetMin} > 0 AND ${table.budgetMax} >= ${table.budgetMin}`,
    ),
  ],
);

export const jobListingMilestones = pgTable(
  "job_listing_milestones",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    listingId: uuid("listing_id")
      .notNull()
      .references(() => jobListings.id, { onDelete: "cascade" }),
    sequence: integer("sequence").notNull(),
    title: varchar("title", { length: 120 }).notNull(),
    deliverable: text("deliverable").notNull(),
    acceptanceCriteria: text("acceptance_criteria").notNull(),
    evidenceRequirements: text("evidence_requirements").notNull(),
    deliveryDays: integer("delivery_days").notNull(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("job_listing_milestone_sequence_unique").on(table.listingId, table.sequence),
    index("job_listing_milestones_listing_idx").on(table.listingId, table.sequence),
    check("job_listing_milestone_delivery_valid", sql`${table.deliveryDays} BETWEEN 1 AND 365`),
  ],
);

export const proposals = pgTable(
  "proposals",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    listingId: uuid("listing_id")
      .notNull()
      .references(() => jobListings.id, { onDelete: "cascade" }),
    workerUserId: uuid("worker_user_id")
      .notNull()
      .references(() => users.id),
    coverLetter: text("cover_letter").notNull(),
    totalBid: bigint("total_bid", { mode: "bigint" }).notNull(),
    estimatedDurationDays: integer("estimated_duration_days").notNull(),
    status: proposalStatusEnum("status").default("SUBMITTED").notNull(),
    shortlistedAt: timestamp("shortlisted_at", { withTimezone: true }),
    shortlistedBy: uuid("shortlisted_by").references(() => users.id),
    submittedAt: timestamp("submitted_at", { withTimezone: true }).defaultNow().notNull(),
    withdrawnAt: timestamp("withdrawn_at", { withTimezone: true }),
    decidedAt: timestamp("decided_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("proposal_listing_worker_unique").on(table.listingId, table.workerUserId),
    index("proposals_listing_idx").on(table.listingId, table.createdAt),
    index("proposals_shortlist_idx").on(table.listingId, table.shortlistedAt),
    index("proposals_worker_idx").on(table.workerUserId, table.createdAt),
    check("proposal_amount_positive", sql`${table.totalBid} > 0`),
    check("proposal_duration_valid", sql`${table.estimatedDurationDays} BETWEEN 1 AND 365`),
  ],
);

export const proposalMilestones = pgTable(
  "proposal_milestones",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    proposalId: uuid("proposal_id")
      .notNull()
      .references(() => proposals.id, { onDelete: "cascade" }),
    sequence: integer("sequence").notNull(),
    title: varchar("title", { length: 120 }).notNull(),
    description: text("description").notNull(),
    acceptanceCriteria: text("acceptance_criteria").default("").notNull(),
    amount: bigint("amount", { mode: "bigint" }).notNull(),
    evidenceRequirements: text("evidence_requirements").notNull(),
    deliveryDays: integer("delivery_days").notNull(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("proposal_milestone_sequence_unique").on(table.proposalId, table.sequence),
    check("proposal_milestone_amount_positive", sql`${table.amount} > 0`),
    check("proposal_milestone_delivery_valid", sql`${table.deliveryDays} BETWEEN 1 AND 365`),
  ],
);

export const proposalMessages = pgTable(
  "proposal_messages",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    proposalId: uuid("proposal_id")
      .notNull()
      .references(() => proposals.id, { onDelete: "cascade" }),
    senderUserId: uuid("sender_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    body: text("body").notNull(),
    editedAt: timestamp("edited_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("proposal_messages_thread_idx").on(table.proposalId, table.createdAt),
    index("proposal_messages_sender_idx").on(table.senderUserId, table.createdAt),
    check("proposal_message_body_length", sql`char_length(${table.body}) BETWEEN 1 AND 2000`),
  ],
);

export const proposalThreadReads = pgTable(
  "proposal_thread_reads",
  {
    proposalId: uuid("proposal_id")
      .notNull()
      .references(() => proposals.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    lastReadAt: timestamp("last_read_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.proposalId, table.userId] }),
    index("proposal_thread_reads_user_idx").on(table.userId, table.lastReadAt),
  ],
);

export const marketplaceReviews = pgTable(
  "marketplace_reviews",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    jobId: uuid("job_id")
      .notNull()
      .references(() => jobs.id, { onDelete: "cascade" }),
    reviewerUserId: uuid("reviewer_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    subjectUserId: uuid("subject_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    rating: integer("rating").notNull(),
    comment: text("comment"),
    verifiedAt: timestamp("verified_at", { withTimezone: true }).defaultNow().notNull(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("marketplace_review_job_reviewer_unique").on(table.jobId, table.reviewerUserId),
    index("marketplace_reviews_subject_idx").on(table.subjectUserId, table.createdAt),
    index("marketplace_reviews_job_idx").on(table.jobId),
    check("marketplace_review_rating_valid", sql`${table.rating} BETWEEN 1 AND 5`),
    check(
      "marketplace_review_distinct_users",
      sql`${table.reviewerUserId} <> ${table.subjectUserId}`,
    ),
  ],
);

export const proofSubmissions = pgTable(
  "proof_submissions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    milestoneId: uuid("milestone_id")
      .notNull()
      .references(() => milestones.id),
    submittedBy: uuid("submitted_by")
      .notNull()
      .references(() => users.id),
    version: integer("version").notNull(),
    note: text("note").notNull(),
    links: jsonb("links").$type<string[]>().default([]).notNull(),
    reviewDeadline: timestamp("review_deadline", { withTimezone: true }).notNull(),
    submittedAt: timestamp("submitted_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [uniqueIndex("proof_milestone_version_unique").on(table.milestoneId, table.version)],
);

export const proofFiles = pgTable(
  "proof_files",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    proofSubmissionId: uuid("proof_submission_id")
      .notNull()
      .references(() => proofSubmissions.id, { onDelete: "cascade" }),
    storageKey: text("storage_key").notNull(),
    originalName: varchar("original_name", { length: 255 }).notNull(),
    contentType: varchar("content_type", { length: 120 }).notNull(),
    sizeBytes: bigint("size_bytes", { mode: "number" }).notNull(),
    sha256: varchar("sha256", { length: 64 }).notNull(),
    scanStatus: varchar("scan_status", { length: 30 }).default("PENDING").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("proof_file_storage_key_unique").on(table.storageKey),
    check("proof_file_size_valid", sql`${table.sizeBytes} > 0 AND ${table.sizeBytes} <= 26214400`),
  ],
);

export const reviews = pgTable("reviews", {
  id: uuid("id").defaultRandom().primaryKey(),
  milestoneId: uuid("milestone_id")
    .notNull()
    .references(() => milestones.id),
  proofSubmissionId: uuid("proof_submission_id")
    .notNull()
    .references(() => proofSubmissions.id),
  reviewerUserId: uuid("reviewer_user_id")
    .notNull()
    .references(() => users.id),
  decision: varchar("decision", { length: 30 }).notNull(),
  reason: text("reason"),
  automatic: boolean("automatic").default(false).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const revisionRequests = pgTable("revision_requests", {
  id: uuid("id").defaultRandom().primaryKey(),
  milestoneId: uuid("milestone_id")
    .notNull()
    .references(() => milestones.id),
  proofSubmissionId: uuid("proof_submission_id")
    .notNull()
    .references(() => proofSubmissions.id),
  requestedBy: uuid("requested_by")
    .notNull()
    .references(() => users.id),
  reason: text("reason").notNull(),
  responseDueAt: timestamp("response_due_at", { withTimezone: true }).notNull(),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const disputes = pgTable(
  "disputes",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    reference: varchar("reference", { length: 30 }).notNull(),
    jobId: uuid("job_id")
      .notNull()
      .references(() => jobs.id),
    milestoneId: uuid("milestone_id").references(() => milestones.id),
    openedBy: uuid("opened_by")
      .notNull()
      .references(() => users.id),
    reasonCode: varchar("reason_code", { length: 60 }).notNull(),
    description: text("description").notNull(),
    status: disputeStatusEnum("status").default("OPEN").notNull(),
    evidenceDueAt: timestamp("evidence_due_at", { withTimezone: true }).notNull(),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("disputes_reference_unique").on(table.reference),
    index("disputes_job_idx").on(table.jobId),
  ],
);

export const disputeEvidence = pgTable("dispute_evidence", {
  id: uuid("id").defaultRandom().primaryKey(),
  disputeId: uuid("dispute_id")
    .notNull()
    .references(() => disputes.id, { onDelete: "cascade" }),
  submittedBy: uuid("submitted_by")
    .notNull()
    .references(() => users.id),
  note: text("note").notNull(),
  fileId: uuid("file_id").references(() => proofFiles.id),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const disputeFiles = pgTable(
  "dispute_files",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    evidenceId: uuid("evidence_id")
      .notNull()
      .references(() => disputeEvidence.id, { onDelete: "cascade" }),
    storageKey: text("storage_key").notNull(),
    originalName: varchar("original_name", { length: 255 }).notNull(),
    contentType: varchar("content_type", { length: 120 }).notNull(),
    sizeBytes: bigint("size_bytes", { mode: "number" }).notNull(),
    sha256: varchar("sha256", { length: 64 }).notNull(),
    scanStatus: varchar("scan_status", { length: 30 }).default("PENDING").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("dispute_file_storage_key_unique").on(table.storageKey),
    index("dispute_file_evidence_idx").on(table.evidenceId),
    check(
      "dispute_file_size_valid",
      sql`${table.sizeBytes} > 0 AND ${table.sizeBytes} <= 26214400`,
    ),
  ],
);

export const disputeEvents = pgTable(
  "dispute_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    disputeId: uuid("dispute_id")
      .notNull()
      .references(() => disputes.id, { onDelete: "cascade" }),
    actorUserId: uuid("actor_user_id").references(() => users.id),
    type: varchar("type", { length: 50 }).notNull(),
    detail: text("detail").notNull(),
    metadata: jsonb("metadata").default({}).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("dispute_event_history_idx").on(table.disputeId, table.createdAt)],
);

export const disputeDecisions = pgTable(
  "dispute_decisions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    disputeId: uuid("dispute_id")
      .notNull()
      .references(() => disputes.id),
    decidedBy: uuid("decided_by")
      .notNull()
      .references(() => users.id),
    requiredApproverId: uuid("required_approver_id").references(() => users.id),
    approvedBy: uuid("approved_by").references(() => users.id),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    workerShareBps: integer("worker_share_bps").notNull(),
    clientRefundBps: integer("client_refund_bps").notNull(),
    rationale: text("rationale").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("dispute_decision_dispute_unique").on(table.disputeId),
    check(
      "dispute_split_complete",
      sql`${table.workerShareBps} >= 0 AND ${table.clientRefundBps} >= 0 AND ${table.workerShareBps} + ${table.clientRefundBps} = 10000`,
    ),
    check(
      "dispute_decision_distinct_approvers",
      sql`${table.decidedBy} <> ${table.requiredApproverId}`,
    ),
  ],
);

export const operations = pgTable(
  "operations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    jobId: uuid("job_id").references(() => jobs.id),
    milestoneId: uuid("milestone_id").references(() => milestones.id),
    initiatedBy: uuid("initiated_by").references(() => users.id),
    type: varchar("type", { length: 40 }).notNull(),
    idempotencyKey: varchar("idempotency_key", { length: 120 }).notNull(),
    amount: bigint("amount", { mode: "bigint" }),
    asset: varchar("asset", { length: 30 }),
    status: operationStatusEnum("status").default("PENDING").notNull(),
    externalReference: varchar("external_reference", { length: 160 }),
    errorCode: varchar("error_code", { length: 80 }),
    metadata: jsonb("metadata").default({}).notNull(),
    ...timestamps,
  },
  (table) => [uniqueIndex("operations_idempotency_unique").on(table.idempotencyKey)],
);

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    actorUserId: uuid("actor_user_id").references(() => users.id),
    action: varchar("action", { length: 100 }).notNull(),
    entityType: varchar("entity_type", { length: 50 }).notNull(),
    entityId: varchar("entity_id", { length: 100 }),
    correlationId: uuid("correlation_id").defaultRandom().notNull(),
    ipHash: varchar("ip_hash", { length: 64 }),
    metadata: jsonb("metadata").default({}).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("audit_entity_idx").on(table.entityType, table.entityId),
    index("audit_actor_idx").on(table.actorUserId),
  ],
);

export const supportTickets = pgTable(
  "support_tickets",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    reference: varchar("reference", { length: 30 }).notNull(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    subject: varchar("subject", { length: 160 }).notNull(),
    category: supportTicketCategoryEnum("category").notNull(),
    referenceId: varchar("reference_id", { length: 60 }),
    status: supportTicketStatusEnum("status").default("OPEN").notNull(),
    priority: supportTicketPriorityEnum("priority").default("NORMAL").notNull(),
    assignedTo: uuid("assigned_to").references(() => users.id, { onDelete: "set null" }),
    lastMessageAt: timestamp("last_message_at", { withTimezone: true }).defaultNow().notNull(),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    closedAt: timestamp("closed_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("support_ticket_reference_unique").on(table.reference),
    index("support_ticket_user_idx").on(table.userId),
    index("support_ticket_queue_idx").on(table.status, table.priority, table.lastMessageAt),
    index("support_ticket_assignee_idx").on(table.assignedTo),
  ],
);

export const supportMessages = pgTable(
  "support_messages",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    ticketId: uuid("ticket_id")
      .notNull()
      .references(() => supportTickets.id, { onDelete: "cascade" }),
    senderId: uuid("sender_id").references(() => users.id, { onDelete: "set null" }),
    senderType: supportSenderTypeEnum("sender_type").notNull(),
    message: text("message").notNull(),
    internal: boolean("internal").default(false).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("support_message_ticket_idx").on(table.ticketId, table.createdAt)],
);

export const supportAttachments = pgTable(
  "support_attachments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    messageId: uuid("message_id")
      .notNull()
      .references(() => supportMessages.id, { onDelete: "cascade" }),
    storageKey: text("storage_key").notNull(),
    originalName: varchar("original_name", { length: 255 }).notNull(),
    contentType: varchar("content_type", { length: 120 }).notNull(),
    sizeBytes: bigint("size_bytes", { mode: "number" }).notNull(),
    sha256: varchar("sha256", { length: 64 }).notNull(),
    scanStatus: varchar("scan_status", { length: 30 }).default("CLEAN").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("support_attachment_storage_key_unique").on(table.storageKey),
    check(
      "support_attachment_size_valid",
      sql`${table.sizeBytes} > 0 AND ${table.sizeBytes} <= 26214400`,
    ),
  ],
);

export const supportTicketEvents = pgTable(
  "support_ticket_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    ticketId: uuid("ticket_id")
      .notNull()
      .references(() => supportTickets.id, { onDelete: "cascade" }),
    actorUserId: uuid("actor_user_id").references(() => users.id, { onDelete: "set null" }),
    type: varchar("type", { length: 50 }).notNull(),
    metadata: jsonb("metadata").default({}).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("support_event_ticket_idx").on(table.ticketId, table.createdAt)],
);

export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: varchar("type", { length: 50 }).notNull(),
    title: varchar("title", { length: 160 }).notNull(),
    body: text("body").notNull(),
    href: text("href"),
    dedupeKey: varchar("dedupe_key", { length: 200 }),
    readAt: timestamp("read_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("notification_user_idx").on(table.userId, table.createdAt),
    uniqueIndex("notification_user_dedupe_unique").on(table.userId, table.dedupeKey),
  ],
);

export const notificationPreferences = pgTable("notification_preferences", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  proposalEmails: boolean("proposal_emails").default(true).notNull(),
  messageEmails: boolean("message_emails").default(true).notNull(),
  jobEmails: boolean("job_emails").default(true).notNull(),
  disputeEmails: boolean("dispute_emails").default(true).notNull(),
  supportEmails: boolean("support_emails").default(true).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const notificationDeliveries = pgTable(
  "notification_deliveries",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    notificationId: uuid("notification_id")
      .notNull()
      .references(() => notifications.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    channel: varchar("channel", { length: 20 }).default("EMAIL").notNull(),
    recipient: varchar("recipient", { length: 320 }).notNull(),
    subject: varchar("subject", { length: 200 }).notNull(),
    textBody: text("text_body").notNull(),
    htmlBody: text("html_body").notNull(),
    dedupeKey: varchar("dedupe_key", { length: 200 }).notNull(),
    status: varchar("status", { length: 20 }).default("PENDING").notNull(),
    attempts: integer("attempts").default(0).notNull(),
    nextAttemptAt: timestamp("next_attempt_at", { withTimezone: true }).defaultNow().notNull(),
    deliveredAt: timestamp("delivered_at", { withTimezone: true }),
    lastError: text("last_error"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("notification_delivery_dedupe_unique").on(table.channel, table.dedupeKey),
    index("notification_delivery_retry_idx").on(table.status, table.nextAttemptAt),
  ],
);
