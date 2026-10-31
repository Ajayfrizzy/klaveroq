import type { PolicySection } from "../registry";
export const privacy: PolicySection[] = [
  {
    id: "scope",
    title: "1. Scope and responsible operator",
    paragraphs: [
      "This draft describes information handling in Klaveroq’s community beta. The operator’s formal legal identity, privacy contact details and any required representative or data protection officer appointment must be verified before approval. No certification or regulatory authorisation is claimed.",
      "You can already send a privacy or account-support request without signing in. This route records your contact email and message for authorised review; it does not automatically export data, erase records or change your account.",
    ],
    links: [{ label: "Submit a privacy request", href: "/account/privacy" }],
  },
  {
    id: "account",
    title: "2. Account, authentication and security information",
    paragraphs: [
      "We process account email, display name, verification state, account status and creation or update times. Password accounts use a password hash rather than a stored readable password. If you choose Google sign-in, the integration uses Google’s account identifier and verified account information, including email and available name or image information, to establish the account link.",
      "Sign-in uses session records, expiry and revocation information, browser user-agent information and an IP-derived hash. Email verification, password reset and recovery use short-lived tokens. Enabled two-factor authentication uses a protected authenticator secret and hashed recovery codes. Security and audit records record relevant actions, actors, timestamps and references. Hosting infrastructure may also process request and connection logs under its own operational configuration.",
    ],
  },
  {
    id: "marketplace",
    title: "3. Profiles, work and communications",
    paragraphs: [
      "Profile information may include your name, biography, skills, role, location, time zone, availability, experience and portfolio descriptions. You control eligible profile publication. Published information can be seen by visitors and other users; a private setting does not make past disclosures or copies held by others disappear.",
      "Jobs, proposals, Client Invites, agreement and milestone records, messages, delivery and review information, support cases and notifications contain information supplied by participants. Invitations include a recipient email and project message even when the recipient has not registered. Counterparties and intended recipients receive information necessary for the relevant interaction. Do not submit another person’s confidential information without authority.",
      "Saved searches, shortlists, workspace focus and notification preferences support your account experience. Wallet testing can record addresses, networks, challenges and verification evidence. Historical payment-related or identity-related records may exist even though real payments and government-ID checks are not operational. New uploads are disabled; existing file metadata or retained evidence is not automatically destroyed.",
    ],
  },
  {
    id: "purposes",
    title: "4. Purposes and legal bases requiring confirmation",
    paragraphs: [
      "Information supports account access, requested marketplace features, communications, preferences, safety checks, support and account recovery. Security and audit information helps investigate abuse and preserve evidence. Shared agreement records support participants’ ongoing obligations and legitimate recordkeeping.",
      "The proposed basis for necessary account and requested service processing is performance of a contract or steps requested before a contract. Security, abuse prevention and limited operational recordkeeping may rely on legitimate interests after assessing necessity and the effect on people. Specific records may require retention to comply with an identified legal obligation or establish, exercise or defend legal claims. Consent, where legally required for an optional purpose, must be specific and separately obtained.",
      "These are proposed purpose-to-basis classifications, not a completed legal assessment. The operator must confirm the applicable Nigerian and other relevant requirements, documented legitimate-interest assessments and any actual legal retention duties. This draft does not treat registration as blanket consent for all uses or claim a legal duty where none has been established.",
    ],
  },
  {
    id: "providers",
    title: "5. Recipients and service providers",
    paragraphs: [
      "The current beta infrastructure identified by the operator uses RumptyCloud for application hosting and Supabase for PostgreSQL database hosting. These services process application or stored data as needed to provide that infrastructure. Klaveroq implements its own account sessions; use of a Supabase database does not mean Supabase Auth is the sign-in service.",
      "The application integrates Resend for hosted email delivery, including recipient addresses, message contents and delivery identifiers or events. The live provider and its contractual details require operator confirmation before this notice is approved. Local development uses simulated delivery. Google processes information when you choose its sign-in service; provider processing and roles must be assessed under the applicable provider terms.",
      "Authorised support, risk and dispute administrators can access records relevant to their permitted functions. Other participants can access shared work records according to their role. Disclosure to authorities or advisers requires an appropriate legal or operational justification. This draft does not assert that every service named in source code is active, or that the same processor role applies to every recipient.",
    ],
  },
  {
    id: "transfers",
    title: "6. International processing and security",
    paragraphs: [
      "Providers and recipients may process information outside your country. Hosting regions, subprocessors, contractual safeguards and any required international-transfer mechanism must be verified for the actual deployment before approval. No particular data-residency guarantee or transfer certification is asserted here.",
      "Application controls include password hashing, protected sign-in cookies, session revocation, access checks, request-origin checks, rate limiting and optional two-factor authentication. These reduce risk but do not guarantee absolute security. Encryption arrangements, backups, provider controls and incident-response commitments require deployment and contractual verification; this notice does not promise end-to-end encryption.",
    ],
  },
  {
    id: "retention",
    title: "7. Retention and account closure",
    paragraphs: [
      "Retention depends on purpose, account state, shared obligations, security needs and applicable law. There is no single approved duration for all agreements, financial records or audit evidence. Account closure hides the public profile and revokes sessions, with a 30-day opportunity for explicit recovery. Historical shared or legally necessary records may remain and require restricted review.",
      "Automatic final account cleanup is not activated in the current beta pending retention and compliance review. The end of the recovery window does not promise immediate or complete erasure. Privacy requests can seek earlier handling or a retention exception; applicable statutory request deadlines are separate from this product recovery window. Copies held by counterparties, external providers and backups require their own assessed handling.",
    ],
    links: [{ label: "Read the account-deletion notice", href: "/legal/account-deletion" }],
  },
  {
    id: "rights",
    title: "8. Your choices, rights and complaints",
    paragraphs: [
      "You can edit profile information, manage eligible visibility and notification preferences, review sessions and use the account closure and recovery flows. Depending on applicable law, you may have rights to information, access, correction, erasure, restriction, objection and portability, and to withdraw consent where processing relies on consent. Withdrawal does not by itself undo earlier lawful processing.",
      "Use the public privacy form to identify the request and provide a contact email. We may need proportionate identity or authority verification before disclosing information or making changes, and must consider the rights of others and applicable exceptions. Do not attach passwords, recovery codes or government-ID documents. Retain the reference returned by the form for follow-up.",
      "You may complain to a competent data protection authority, including the Nigeria Data Protection Commission where Nigerian law applies. You do not have to give up statutory complaint rights to use our support route. No universal response deadline or guaranteed outcome is promised in this draft; the operator must implement the deadlines and escalation process required for the relevant request.",
    ],
    links: [
      { label: "Privacy and account support", href: "/account/privacy" },
      { label: "Cookies and browser storage", href: "/legal/cookies" },
    ],
  },
  {
    id: "updates",
    title: "9. Changes to this notice",
    paragraphs: [
      "This notice must be reviewed when providers, countries served, retention practices, live payments, identity verification or uploads change. An approved version must identify the responsible operator, verified contact and effective date. New purposes or consent requirements cannot be introduced merely by changing the draft text.",
    ],
  },
];
