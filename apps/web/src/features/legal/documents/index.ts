import type { PolicySection, PolicySlug } from "../registry";
import { terms } from "./terms";
import { privacy } from "./privacy";
import { accountDeletion } from "./account-deletion";
import { communityGuidelines } from "./community-guidelines";
import { cookies } from "./cookies";
import { payments } from "./payments";
export const policyDocuments: Record<PolicySlug, PolicySection[]> = {
  terms,
  privacy,
  "account-deletion": accountDeletion,
  "community-guidelines": communityGuidelines,
  cookies,
  payments,
};
