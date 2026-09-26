import { ArrowRight, BriefcaseBusiness, Mail } from "lucide-react";
import Link from "next/link";
import { MarketplaceLayout } from "@/features/marketplace/components/marketplace-layout";
export default function NewJobPage() {
  return (
    <MarketplaceLayout>
      <div className="creation-choice">
        <div>
          <p className="eyebrow">Create job</p>
          <h1>How do you want to hire?</h1>
          <p>Invite a worker you know or collect sealed proposals from the public marketplace.</p>
        </div>
        <section>
          <Link href="/jobs/new/direct">
            <span>
              <Mail size={22} />
            </span>
            <h2>Direct invite</h2>
            <p>Define milestones and invite a specific worker by email.</p>
            <b>
              Continue <ArrowRight size={16} />
            </b>
          </Link>
          <Link href="/jobs/new/public">
            <span>
              <BriefcaseBusiness size={22} />
            </span>
            <h2>Post publicly</h2>
            <p>Publish a budget and compare private worker proposals.</p>
            <b>
              Continue <ArrowRight size={16} />
            </b>
          </Link>
        </section>
        <Link className="back-link" href="/jobs">
          Back to jobs
        </Link>
      </div>
    </MarketplaceLayout>
  );
}
