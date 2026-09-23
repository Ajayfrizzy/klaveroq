import { and, eq, sql } from "drizzle-orm";
import { db, sqlClient } from "./index";
import { hashPassword } from "../auth/password";
import {
  identityVerifications,
  jobListingMilestones,
  jobListings,
  jobs,
  marketplaceReviews,
  milestones,
  portfolioItems,
  profiles,
  proofSubmissions,
  proposalMilestones,
  proposals,
  users,
  wallets,
} from "./schema";

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  const hostname = databaseUrl ? new URL(databaseUrl).hostname : "";
  if (
    process.env.NODE_ENV === "production" ||
    process.env.KLAVEROQ_ALLOW_LOCAL_SEED !== "1" ||
    !["127.0.0.1", "localhost", "::1"].includes(hostname)
  ) {
    throw new Error(
      "Local seed refused. Set KLAVEROQ_ALLOW_LOCAL_SEED=1 and use a loopback DATABASE_URL.",
    );
  }
  const passwordHash = await hashPassword("KlaveroqDemo!2026");
  const demoUsers = [
    {
      email: "client@klaveroq.local",
      displayName: "Alex Morgan",
      role: "USER" as const,
      headline: "Product leader for digital commerce teams",
      primaryRole: "Product strategy",
      skills: ["product strategy", "market research", "fintech"],
      isPublic: true,
    },
    {
      email: "worker@klaveroq.local",
      displayName: "Maya Chen",
      role: "USER" as const,
      headline: "Frontend engineer building accessible data products",
      primaryRole: "Frontend engineering",
      skills: ["react", "typescript", "accessibility", "data visualization"],
      isPublic: true,
    },
    {
      email: "designer@klaveroq.local",
      displayName: "Idris Bello",
      role: "USER" as const,
      headline: "Product designer for complex financial workflows",
      primaryRole: "Product design",
      skills: ["product design", "figma", "ux research", "design systems"],
      isPublic: true,
    },
    {
      email: "writer@klaveroq.local",
      displayName: "Sofia Alvarez",
      role: "USER" as const,
      headline: "Content designer focused on clear product guidance",
      primaryRole: "Content design",
      skills: ["content design", "ux writing", "fintech", "research"],
      isPublic: true,
    },
    {
      email: "admin@klaveroq.local",
      displayName: "Jordan Okafor",
      role: "DISPUTE_ADMIN" as const,
      headline: "Klaveroq operations",
      primaryRole: "Marketplace operations",
      skills: [],
      isPublic: false,
    },
    {
      email: "support@klaveroq.local",
      displayName: "Amara Support",
      role: "SUPPORT" as const,
      headline: "Klaveroq support",
      primaryRole: "Customer support",
      skills: [],
      isPublic: false,
    },
  ];

  for (const item of demoUsers) {
    const [found] = await db
      .select()
      .from(users)
      .where(sql`lower(${users.email}) = ${item.email}`)
      .limit(1);
    const [user] = found
      ? await db
          .update(users)
          .set({
            passwordHash,
            status: "ACTIVE",
            systemRole: item.role,
            emailVerifiedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(users.id, found.id))
          .returning()
      : await db
          .insert(users)
          .values({
            email: item.email,
            passwordHash,
            emailVerifiedAt: new Date(),
            status: "ACTIVE",
            systemRole: item.role,
          })
          .returning();
    await db
      .insert(profiles)
      .values({
        userId: user.id,
        displayName: item.displayName,
        headline: item.headline,
        bio: "Experienced professional delivering clear, verifiable outcomes through milestone-based work.",
        primaryRole: item.primaryRole,
        skills: item.skills,
        experienceLevel: "EXPERT",
        yearsExperience: item.role === "USER" ? 8 : 5,
        languages: ["english"],
        availability: item.role === "USER" ? "AVAILABLE" : "UNAVAILABLE",
        preferredWorkCategories: item.role === "USER" ? ["DESIGN", "DEVELOPMENT"] : [],
        countryCode: "NG",
        isPublic: item.isPublic,
      })
      .onConflictDoUpdate({
        target: profiles.userId,
        set: {
          displayName: item.displayName,
          headline: item.headline,
          bio: "Experienced professional delivering clear, verifiable outcomes through milestone-based work.",
          primaryRole: item.primaryRole,
          skills: item.skills,
          experienceLevel: "EXPERT",
          yearsExperience: item.role === "USER" ? 8 : 5,
          languages: ["english"],
          availability: item.role === "USER" ? "AVAILABLE" : "UNAVAILABLE",
          preferredWorkCategories: item.role === "USER" ? ["DESIGN", "DEVELOPMENT"] : [],
          isPublic: item.isPublic,
          updatedAt: new Date(),
        },
      });
    const [existingIdentity] = await db
      .select()
      .from(identityVerifications)
      .where(eq(identityVerifications.userId, user.id))
      .limit(1);
    if (!existingIdentity)
      await db.insert(identityVerifications).values({
        userId: user.id,
        tier: 1,
        provider: "sandbox",
        providerReference: `seed:${user.id}`,
        status: "VERIFIED",
        countryCode: "NG",
        riskLevel: "LOW",
        verifiedAt: new Date(),
        expiresAt: new Date(Date.now() + 365 * 86_400_000),
      });
  }

  const [client] = await db
    .select()
    .from(users)
    .where(sql`lower(${users.email}) = 'client@klaveroq.local'`)
    .limit(1);
  const [worker] = await db
    .select()
    .from(users)
    .where(sql`lower(${users.email}) = 'worker@klaveroq.local'`)
    .limit(1);
  const [designer] = await db
    .select()
    .from(users)
    .where(sql`lower(${users.email}) = 'designer@klaveroq.local'`)
    .limit(1);
  const [writer] = await db
    .select()
    .from(users)
    .where(sql`lower(${users.email}) = 'writer@klaveroq.local'`)
    .limit(1);

  const portfolioSeeds = [
    {
      userId: worker.id,
      title: "Accessible analytics workspace",
      description:
        "Built a responsive analytics workspace with keyboard-friendly filters, accessible data visualizations, and documented component states.",
      projectUrl: "https://example.com/analytics-workspace",
      githubUrl: "https://github.com/example/analytics-workspace",
      skills: ["react", "typescript", "accessibility", "data visualization"],
      projectRole: "Lead frontend engineer",
    },
    {
      userId: designer.id,
      title: "Merchant payout service redesign",
      description:
        "Mapped payout operations, prototyped exception handling, and delivered a tested design system for merchant-facing workflows.",
      projectUrl: "https://example.com/payout-redesign",
      githubUrl: null,
      skills: ["product design", "figma", "ux research", "design systems"],
      projectRole: "Product designer",
    },
    {
      userId: writer.id,
      title: "Financial onboarding content system",
      description:
        "Created reusable onboarding, validation, and recovery patterns for a regulated financial product across responsive web flows.",
      projectUrl: "https://example.com/content-system",
      githubUrl: null,
      skills: ["content design", "ux writing", "fintech"],
      projectRole: "Content designer",
    },
  ];
  for (const item of portfolioSeeds) {
    const [existingPortfolio] = await db
      .select({ id: portfolioItems.id })
      .from(portfolioItems)
      .where(and(eq(portfolioItems.userId, item.userId), eq(portfolioItems.title, item.title)))
      .limit(1);
    if (!existingPortfolio) await db.insert(portfolioItems).values(item);
  }
  const [existingJob] = await db
    .select()
    .from(jobs)
    .where(eq(jobs.reference, "KQ-DEMO-1048"))
    .limit(1);
  if (!existingJob) {
    const [wallet] = await db
      .insert(wallets)
      .values({
        userId: worker.id,
        network: "testnet",
        address: "ckt1qseedworkerpayout000000000000000000000000000000000000",
        purpose: "PAYOUT",
        status: "VERIFIED",
        isDefaultPayout: true,
        verifiedAt: new Date(),
      })
      .returning();
    const [job] = await db
      .insert(jobs)
      .values({
        reference: "KQ-DEMO-1048",
        clientUserId: client.id,
        workerUserId: worker.id,
        workerEmail: worker.email,
        title: "Checkout experience redesign",
        description:
          "Design and validate a clearer checkout flow with responsive production-ready screens.",
        subtotal: 150_000_000_000n,
        clientFee: 4_500_000_000n,
        networkReserve: 20_000_000n,
        status: "IN_PROGRESS",
        fundedAt: new Date(),
        acceptedAt: new Date(),
        acceptanceExpiresAt: new Date(Date.now() + 7 * 86_400_000),
      })
      .returning();
    await db.insert(milestones).values([
      {
        jobId: job.id,
        sequence: 1,
        title: "Research and wireframes",
        description: "Map the flow and provide validated wireframes.",
        acceptanceCriteria:
          "The mapped flow covers agreed checkout states and the wireframes are ready for review.",
        amount: 50_000_000_000n,
        dueAt: new Date(Date.now() + 7 * 86_400_000),
        evidenceRequirements: "Wireframes and research summary",
        status: "ACTIVE",
      },
      {
        jobId: job.id,
        sequence: 2,
        title: "High-fidelity screens",
        description: "Create responsive desktop and mobile screens.",
        acceptanceCriteria:
          "Desktop and mobile screens cover all approved flows and accessibility states.",
        amount: 65_000_000_000n,
        dueAt: new Date(Date.now() + 14 * 86_400_000),
        evidenceRequirements: "Figma link and exported screens",
      },
      {
        jobId: job.id,
        sequence: 3,
        title: "Handoff and revisions",
        description: "Resolve feedback and provide implementation notes.",
        acceptanceCriteria: "Agreed feedback is resolved and implementation notes are complete.",
        amount: 35_000_000_000n,
        dueAt: new Date(Date.now() + 21 * 86_400_000),
        evidenceRequirements: "Final design link and handoff notes",
      },
    ]);
    void wallet;
  }

  const [completedDemoJob] = await db
    .select()
    .from(jobs)
    .where(eq(jobs.reference, "KQ-DEMO-COMPLETE"))
    .limit(1);
  if (!completedDemoJob) {
    const startedAt = new Date(Date.now() - 35 * 86_400_000);
    const completedAt = new Date(Date.now() - 18 * 86_400_000);
    const [job] = await db
      .insert(jobs)
      .values({
        reference: "KQ-DEMO-COMPLETE",
        clientUserId: client.id,
        workerUserId: worker.id,
        workerEmail: worker.email,
        title: "Accessible reporting interface",
        description:
          "Implement and document an accessible reporting interface with filters and export states.",
        subtotal: 90_000_000_000n,
        clientFee: 2_700_000_000n,
        networkReserve: 20_000_000n,
        status: "COMPLETED",
        fundedAt: startedAt,
        acceptedAt: startedAt,
        completedAt,
        createdAt: startedAt,
        updatedAt: completedAt,
      })
      .returning();
    const releasedMilestones = await db
      .insert(milestones)
      .values([
        {
          jobId: job.id,
          sequence: 1,
          title: "Reporting foundation",
          description: "Build the report shell, filter controls, and accessible table states.",
          acceptanceCriteria:
            "Keyboard and screen-reader checks pass for the agreed table and filter flows.",
          amount: 40_000_000_000n,
          dueAt: new Date(startedAt.getTime() + 8 * 86_400_000),
          evidenceRequirements: "Preview URL, accessibility checklist, and source commit",
          status: "RELEASED",
          createdAt: startedAt,
          updatedAt: completedAt,
        },
        {
          jobId: job.id,
          sequence: 2,
          title: "Exports and handoff",
          description: "Complete export states, responsive checks, tests, and handoff notes.",
          acceptanceCriteria: "Exports work for agreed formats and the regression checks pass.",
          amount: 50_000_000_000n,
          dueAt: new Date(startedAt.getTime() + 18 * 86_400_000),
          evidenceRequirements: "Test report, final preview URL, and handoff document",
          status: "RELEASED",
          createdAt: startedAt,
          updatedAt: completedAt,
        },
      ])
      .returning();
    await db.insert(proofSubmissions).values(
      releasedMilestones.map((milestone, index) => ({
        milestoneId: milestone.id,
        submittedBy: worker.id,
        version: 1,
        note: "Completed demo delivery with the agreed evidence and review materials.",
        links: ["https://example.com/accessible-reporting-delivery"],
        reviewDeadline: new Date(startedAt.getTime() + (index === 0 ? 12 : 22) * 86_400_000),
        submittedAt: new Date(startedAt.getTime() + (index === 0 ? 7 : 16) * 86_400_000),
      })),
    );
    await db.insert(marketplaceReviews).values([
      {
        jobId: job.id,
        reviewerUserId: client.id,
        subjectUserId: worker.id,
        rating: 5,
        comment:
          "Clear milestone communication, strong accessibility work, and complete delivery evidence.",
        verifiedAt: completedAt,
      },
      {
        jobId: job.id,
        reviewerUserId: worker.id,
        subjectUserId: client.id,
        rating: 5,
        comment: "Clear scope, timely reviews, and actionable milestone feedback.",
        verifiedAt: completedAt,
      },
    ]);
  }

  const [existingListing] = await db
    .select()
    .from(jobListings)
    .where(eq(jobListings.title, "Build a responsive analytics dashboard"))
    .limit(1);
  if (!existingListing) {
    const [listing] = await db
      .insert(jobListings)
      .values({
        clientUserId: client.id,
        title: "Build a responsive analytics dashboard",
        description:
          "Design and implement a responsive operations dashboard with accessible charts, filters, empty states, and a documented component handoff.",
        category: "DEVELOPMENT",
        skills: ["react", "typescript", "data visualization"],
        budgetMin: 120_000_000_000n,
        budgetMax: 180_000_000_000n,
        proposalDeadline: new Date(Date.now() + 10 * 86_400_000),
        status: "OPEN",
        publishedAt: new Date(),
      })
      .returning();
    await db.insert(jobListingMilestones).values([
      {
        listingId: listing.id,
        sequence: 1,
        title: "Dashboard foundation",
        deliverable:
          "Responsive application shell, navigation, design tokens, and documented data contracts.",
        acceptanceCriteria:
          "The shell works at agreed breakpoints and keyboard navigation follows the approved structure.",
        evidenceRequirements: "Preview URL, source commit, and responsive verification notes",
        deliveryDays: 7,
      },
      {
        listingId: listing.id,
        sequence: 2,
        title: "Interactive dashboard",
        deliverable:
          "Accessible charts, filters, loading states, empty states, tests, and handoff notes.",
        acceptanceCriteria:
          "The agreed data states and interactions pass functional and accessibility review.",
        evidenceRequirements: "Final preview URL, test report, and completion walkthrough",
        deliveryDays: 21,
      },
    ]);
    const [proposal] = await db
      .insert(proposals)
      .values({
        listingId: listing.id,
        workerUserId: worker.id,
        coverLetter:
          "I will build the dashboard as an accessible component system, validate the responsive states, and provide a concise implementation handoff with tested interactions.",
        totalBid: 150_000_000_000n,
        estimatedDurationDays: 21,
      })
      .returning();
    await db.insert(proposalMilestones).values([
      {
        proposalId: proposal.id,
        sequence: 1,
        title: "Dashboard foundation",
        description: "Responsive shell, navigation, tokens, and data contracts.",
        acceptanceCriteria:
          "The shell works at agreed breakpoints and the navigation is keyboard accessible.",
        amount: 60_000_000_000n,
        evidenceRequirements: "Preview URL and source commit",
        deliveryDays: 7,
      },
      {
        proposalId: proposal.id,
        sequence: 2,
        title: "Charts and filters",
        description: "Accessible charts, filters, loading states, and empty states.",
        acceptanceCriteria:
          "Charts and filters expose agreed states and pass keyboard and screen-reader checks.",
        amount: 60_000_000_000n,
        evidenceRequirements: "Preview URL and interaction recording",
        deliveryDays: 14,
      },
      {
        proposalId: proposal.id,
        sequence: 3,
        title: "Testing and handoff",
        description: "Responsive verification, fixes, and implementation documentation.",
        acceptanceCriteria:
          "The regression suite passes and complete handoff documentation is available.",
        amount: 30_000_000_000n,
        evidenceRequirements: "Test report and handoff document",
        deliveryDays: 21,
      },
    ]);
    await db.insert(jobListings).values([
      {
        clientUserId: client.id,
        title: "Create a fintech onboarding content system",
        description:
          "Develop concise onboarding copy, validation guidance, and reusable content patterns for a financial product across web and mobile.",
        category: "WRITING",
        skills: ["ux writing", "fintech", "content design"],
        budgetMin: 45_000_000_000n,
        budgetMax: 80_000_000_000n,
        proposalDeadline: new Date(Date.now() + 6 * 86_400_000),
        status: "OPEN",
        publishedAt: new Date(Date.now() - 86_400_000),
      },
      {
        clientUserId: client.id,
        title: "Research merchant payout workflows",
        description:
          "Interview representative merchants and synthesize operational pain points, opportunity areas, and a prioritized service blueprint.",
        category: "DESIGN",
        skills: ["ux research", "service design"],
        budgetMin: 90_000_000_000n,
        budgetMax: 130_000_000_000n,
        proposalDeadline: new Date(Date.now() - 86_400_000),
        status: "CLOSED",
        publishedAt: new Date(Date.now() - 12 * 86_400_000),
        closedAt: new Date(),
      },
    ]);
  }

  console.log("Seed complete. Demo password: KlaveroqDemo!2026");
}

main()
  .catch((error: unknown) => {
    console.error("Seed failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await sqlClient.end();
  });
