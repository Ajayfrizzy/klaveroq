import { Activity, FileCheck2 } from "lucide-react";
import { desc, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { getCurrentUser } from "@/server/auth/session";
import { db } from "@/server/db";
import { auditLogs } from "@/server/db/schema";
import Link from "next/link";
import {
  activityDestination,
  describeActivity,
  formatEventTime,
} from "@/features/activity/presentation";

export default async function ActivityPage() {
  const current = await getCurrentUser();
  if (!current) redirect("/login?returnTo=%2Factivity");
  const events = await db
    .select()
    .from(auditLogs)
    .where(eq(auditLogs.actorUserId, current.user.id))
    .orderBy(desc(auditLogs.createdAt))
    .limit(100);
  return (
    <AppShell>
      <PageHeader
        eyebrow="Your workspace"
        title="Activity"
        description="Your recent account updates and marketplace actions. Times are shown in UTC."
        icon={Activity}
      />
      <section className="panel full-activity">
        {events.length ? (
          <div className="activity-group">
            <h2>Recent events</h2>
            {events.map((event) => (
              <article key={event.id}>
                <span className="event-icon">
                  <FileCheck2 size={17} />
                </span>
                <div>
                  <strong>{describeActivity(event.action)}</strong>
                  {activityDestination(event.action) && (
                    <p>
                      <Link href={activityDestination(event.action)!}>Open related workspace</Link>
                    </p>
                  )}
                </div>
                <time dateTime={event.createdAt.toISOString()}>
                  {formatEventTime(event.createdAt)}
                </time>
              </article>
            ))}
          </div>
        ) : (
          <div className="market-empty account-empty">
            <Activity size={26} />
            <h2>No activity yet</h2>
            <p>Your account actions will appear here when they are recorded.</p>
          </div>
        )}
      </section>
    </AppShell>
  );
}
