import { and, asc, eq } from "drizzle-orm";
import {
  ArrowLeft,
  BadgeCheck,
  CalendarDays,
  CircleDollarSign,
  LockKeyhole,
  Star,
  UserRound,
  UsersRound,
} from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/server/db";
import { jobListingMilestones, proposalMilestones, proposals } from "@/server/db/schema";
import { getCurrentUser } from "@/server/auth/session";
import { getProposalEvaluations, getPublicListing } from "@/features/marketplace/server/queries";
import { MarketplaceHeader } from "@/features/marketplace/components/marketplace-header";
import { ProposalComposer } from "@/features/marketplace/components/proposal-composer";
import { ClientProposals } from "@/features/marketplace/components/client-proposals";
import { ProposalThread } from "@/features/marketplace/components/proposal-thread";
import {
  getPreviewMarketplaceListing,
  getPreviewMarketplaceMilestones,
} from "@/features/marketplace/fixtures";
import { usesPreviewData } from "@/server/deployment";
import { getReputationSummary } from "@/features/reputation/server/queries";
export const dynamic = "force-dynamic";
const ckb = (value: bigint) => new Intl.NumberFormat().format(Number(value) / 100_000_000);
const countryNames = new Intl.DisplayNames(["en"], { type: "region" });
export default async function ListingDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const preview = usesPreviewData();
  const [record, current, listingMilestones] = preview
    ? [getPreviewMarketplaceListing(id), null, getPreviewMarketplaceMilestones(id)]
    : await Promise.all([
        getPublicListing(id),
        getCurrentUser(),
        db
          .select()
          .from(jobListingMilestones)
          .where(eq(jobListingMilestones.listingId, id))
          .orderBy(asc(jobListingMilestones.sequence)),
      ]);
  if (!record || record.listing.status === "DRAFT" || record.listing.status === "CANCELLED")
    notFound();
  const clientReputation = preview ? null : await getReputationSummary(record.listing.clientUserId);
  const owner = current?.user.id === record.listing.clientUserId;
  const canSubmit =
    record.listing.status === "OPEN" && record.listing.proposalDeadline > new Date();
  let ownProposal:
    | {
        coverLetter: string;
        estimatedDurationDays: number;
        milestones: Array<{
          title: string;
          description: string;
          acceptanceCriteria: string;
          amount: string;
          evidenceRequirements: string;
          deliveryDays: number;
        }>;
      }
    | undefined;
  let clientRecords: React.ComponentProps<typeof ClientProposals>["records"] = [];
  let workerProposalId: string | undefined;
  if (current && !owner) {
    const [proposal] = await db
      .select()
      .from(proposals)
      .where(and(eq(proposals.listingId, id), eq(proposals.workerUserId, current.user.id)))
      .limit(1);
    workerProposalId = proposal?.id;
    if (proposal?.status === "SUBMITTED")
      ownProposal = {
        ...proposal,
        milestones: (
          await db
            .select()
            .from(proposalMilestones)
            .where(eq(proposalMilestones.proposalId, proposal.id))
            .orderBy(asc(proposalMilestones.sequence))
        ).map((item) => ({ ...item, amount: item.amount.toString() })),
      };
  }
  if (owner) {
    const rows = await getProposalEvaluations(id);
    clientRecords = rows.map((item) => ({
      proposal: {
        ...item.proposal,
        totalBid: item.proposal.totalBid.toString(),
      },
      worker: item.worker,
      reputation: item.reputation,
      portfolioPreview: item.portfolioPreview,
      milestones: item.milestones.map((milestone) => ({
        ...milestone,
        amount: milestone.amount.toString(),
      })),
    }));
  }
  return (
    <div className="market-page">
      <MarketplaceHeader />
      <main>
        <Link className="back-link" href="/discover">
          <ArrowLeft size={16} /> Back to discovery
        </Link>
        <div className="listing-detail-layout">
          <article className="listing-detail">
            <div className="listing-detail-head">
              <span>{record.listing.category.toLowerCase()}</span>
              <span className={`listing-status state-${record.listing.status.toLowerCase()}`}>
                {record.listing.status.toLowerCase()}
              </span>
              <h1>{record.listing.title}</h1>
              <p className="listing-skills-label">Required skills</p>
              <div className="skill-list">
                {record.listing.skills.map((skill) => (
                  <span key={skill}>{skill}</span>
                ))}
              </div>
            </div>
            <section>
              <h2>Scope and expected outcome</h2>
              <p>{record.listing.description}</p>
            </section>
            {listingMilestones.length > 0 && (
              <section className="listing-outcomes">
                <h2>Verifiable milestone expectations</h2>
                <ol>
                  {listingMilestones.map((milestone) => (
                    <li key={milestone.id}>
                      <span>{milestone.sequence}</span>
                      <div>
                        <strong>{milestone.title}</strong>
                        <p>{milestone.deliverable}</p>
                        <small>
                          <strong>How success will be confirmed</strong>
                          {milestone.acceptanceCriteria}
                        </small>
                        <small>
                          <strong>Proof required</strong>
                          {milestone.evidenceRequirements}
                        </small>
                      </div>
                      <b>Day {milestone.deliveryDays}</b>
                    </li>
                  ))}
                </ol>
              </section>
            )}
            <section className="client-public">
              <span className="client-mark">
                {record.client.displayName.slice(0, 2).toUpperCase()}
              </span>
              <div>
                <h2>{record.client.displayName}</h2>
                <p>
                  {record.client.headline || "Veyrivo client"}
                  {record.client.countryCode
                    ? ` · ${countryNames.of(record.client.countryCode) ?? record.client.countryCode}`
                    : ""}
                </p>
                {clientReputation &&
                  (clientReputation.identityVerified || clientReputation.reviewCount > 0) && (
                    <div className="client-trust" aria-label="Client trust signals">
                      {clientReputation.identityVerified && (
                        <span>
                          <BadgeCheck size={13} /> Identity verified
                        </span>
                      )}
                      {clientReputation.reviewCount > 0 && (
                        <span>
                          <Star size={13} /> {clientReputation.averageRating?.toFixed(1)} from{" "}
                          {clientReputation.reviewCount} verified{" "}
                          {clientReputation.reviewCount === 1 ? "review" : "reviews"}
                        </span>
                      )}
                    </div>
                  )}
                <small>{record.client.bio}</small>
              </div>
            </section>
            {owner && (
              <section className="owner-proposals">
                <div className="section-heading">
                  <div>
                    <h2>Proposals</h2>
                    <p>Sealed terms visible only to you.</p>
                  </div>
                  <span>{record.proposalCount}</span>
                </div>
                <ClientProposals records={clientRecords} currentUserId={current!.user.id} />
              </section>
            )}
          </article>
          <aside className="listing-sidebar">
            <section className="listing-facts">
              <div>
                <CircleDollarSign size={18} />
                <span>Budget</span>
                <strong>
                  {ckb(record.listing.budgetMin)}–{ckb(record.listing.budgetMax)} CKB
                </strong>
              </div>
              <div>
                <CalendarDays size={18} />
                <span>Proposal deadline</span>
                <strong>{new Date(record.listing.proposalDeadline).toLocaleDateString()}</strong>
              </div>
              <div>
                <UsersRound size={18} />
                <span>Proposals</span>
                <strong>{record.proposalCount}</strong>
              </div>
              <p>
                <LockKeyhole size={15} /> Proposal details are sealed.
              </p>
            </section>
            {!owner && canSubmit && (
              <ProposalComposer
                listingId={id}
                signedIn={Boolean(current)}
                existing={ownProposal}
                budgetMin={record.listing.budgetMin.toString()}
                budgetMax={record.listing.budgetMax.toString()}
              />
            )}
            {!owner && workerProposalId && current && (
              <ProposalThread
                proposalId={workerProposalId}
                currentUserId={current.user.id}
                closed={!ownProposal}
              />
            )}
            {owner && (
              <section className="owner-note">
                <UserRound size={18} />
                <strong>You posted this job</strong>
                <p>Review sealed proposals on this page.</p>
              </section>
            )}
            {!canSubmit && !owner && (
              <section className="owner-note">
                <strong>Proposals closed</strong>
                <p>This listing is no longer accepting proposals.</p>
              </section>
            )}
          </aside>
        </div>
      </main>
    </div>
  );
}
