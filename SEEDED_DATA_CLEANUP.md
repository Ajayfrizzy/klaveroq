# Seeded demonstration data cleanup

This is a review procedure, not an automated migration. Run the read-only inventory queries first,
verify every returned row, take a database backup, and have an operator approve the final deletion.
Do not assume that every `.local` address is disposable.

Known seed markers are the six emails documented in the README, job references beginning
`KQ-DEMO-`, sandbox operation references, and `identity_verifications.provider_reference` values
beginning `seed:`.

```sql
-- Candidate users. Review IDs and creation dates before proceeding.
select id, email, status, system_role, created_at
from users
where lower(email) in (
  'client@klaveroq.local', 'worker@klaveroq.local', 'designer@klaveroq.local',
  'writer@klaveroq.local', 'admin@klaveroq.local', 'support@klaveroq.local'
);

-- Candidate jobs and marketplace records.
select id, reference, client_user_id, worker_user_id, status, created_at
from jobs where reference like 'KQ-DEMO-%';

select jl.id, jl.title, jl.client_user_id, jl.status, jl.created_at
from job_listings jl
join users u on u.id = jl.client_user_id
where lower(u.email) in (
  'client@klaveroq.local', 'worker@klaveroq.local', 'designer@klaveroq.local',
  'writer@klaveroq.local', 'admin@klaveroq.local', 'support@klaveroq.local'
);

-- Dependencies that must be reviewed before deletion. The exact allowlist avoids
-- accidentally classifying an unrelated .local account as demonstration data.
with seed_users as (
  select id from users where lower(email) in (
    'client@klaveroq.local', 'worker@klaveroq.local', 'designer@klaveroq.local',
    'writer@klaveroq.local', 'admin@klaveroq.local', 'support@klaveroq.local'
  )
), seed_jobs as (
  select id from jobs
  where client_user_id in (select id from seed_users)
     or worker_user_id in (select id from seed_users)
     or reference like 'KQ-DEMO-%'
), seed_listings as (
  select id from job_listings where client_user_id in (select id from seed_users)
)
select 'sessions' source, count(*) from sessions where user_id in (select id from seed_users)
union all select 'auth_identities', count(*) from auth_identities where user_id in (select id from seed_users)
union all select 'profiles', count(*) from profiles where user_id in (select id from seed_users)
union all select 'portfolio_items', count(*) from portfolio_items where user_id in (select id from seed_users)
union all select 'wallets', count(*) from wallets where user_id in (select id from seed_users)
union all select 'identity_verifications', count(*) from identity_verifications where user_id in (select id from seed_users)
union all select 'verification_tokens', count(*) from verification_tokens where user_id in (select id from seed_users)
union all select 'jobs', count(*) from jobs where id in (select id from seed_jobs)
union all select 'job_listings', count(*) from job_listings where id in (select id from seed_listings)
union all select 'proposals', count(*) from proposals where worker_user_id in (select id from seed_users) or listing_id in (select id from seed_listings)
union all select 'operations', count(*) from operations where initiated_by in (select id from seed_users) or job_id in (select id from seed_jobs)
union all select 'audit_logs', count(*) from audit_logs where actor_user_id in (select id from seed_users)
union all select 'notifications', count(*) from notifications where user_id in (select id from seed_users)
union all select 'support_tickets', count(*) from support_tickets where user_id in (select id from seed_users);
```

The schema also links users through profiles, portfolios, wallets, identity checks, verification
tokens, payout destinations, proofs, reviews, disputes, notifications, support tickets, and proposal
messages. Some use cascading deletes and others intentionally restrict deletion. Build the final
transaction from the inspected IDs and current foreign-key definitions, delete children before
parents where required, re-run the inventory, and commit only after confirming no real user or
payment record is in the candidate graph. No deletion SQL is included here by design.
