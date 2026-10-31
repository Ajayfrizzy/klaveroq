import { sql, type SQL } from "drizzle-orm";
// Safe for aliases of a profile owner too; held and unavailable accounts stay hidden
// even if an operator forgot to clear is_public when changing status.
export function publiclyAvailable(userId: SQL | string) {
  return sql`exists(select 1 from users public_account where public_account.id=${userId} and public_account.status in ('ACTIVE','PENDING_EMAIL_VERIFICATION')
 and not exists(select 1 from account_holds where user_id=public_account.id and released_at is null))`;
}
