import type { PolicySection } from "../registry";
export const terms: PolicySection[] = [
  {
    id: "scope",
    title: "1. About these draft terms",
    paragraphs: [
      "Klaveroq is a professional marketplace where clients and independent freelancers discover each other, discuss work and structure agreements around milestones. These proposed terms describe the community beta. They require operator and qualified legal review before becoming effective. Reading this page or creating an account does not record acceptance of this draft.",
      "The operator’s legal identity, business address, minimum eligibility age, governing law and dispute forum remain under review. This draft does not name an incorporated entity, claim a licence, or select a jurisdiction. Nigeria-first operations and an international audience require review of applicable local rights before formal publication.",
    ],
  },
  {
    id: "accounts",
    title: "2. Eligibility and account responsibilities",
    paragraphs: [
      "Use the service only where you have legal capacity and authority to participate, including authority to act for an organisation you represent. The final age and eligibility requirements must be approved before these terms take effect; the beta does not provide an age-verification service.",
      "Provide accurate account information, maintain access to your email and protect passwords, sign-in links and recovery codes. Email verification confirms access to an email address, not professional qualifications or government identity. Use two-factor authentication where appropriate and report suspected unauthorised access promptly. Do not share another person’s credentials or misrepresent your authority.",
    ],
  },
  {
    id: "marketplace",
    title: "3. Clients, freelancers and invitations",
    paragraphs: [
      "An account may both hire and provide services. Clients should describe genuine work, scope, deadlines and requirements accurately. Freelancers should represent their skills, availability and proposed delivery honestly. Each participant remains responsible for evaluating the other party and the suitability and lawfulness of the work.",
      "Public jobs and proposals help participants find one another. Client Invites allow an intended recipient to discuss a private opportunity and continue toward an agreement. An invitation or its acceptance does not itself fund work, transfer money or guarantee a contract. Creating an invitation or proposal is not a payment-protection service. Do not send unsolicited bulk invitations or share private project details without authority.",
    ],
  },
  {
    id: "agreements",
    title: "4. Private agreements and milestones",
    paragraphs: [
      "Participants should agree on scope, deliverables, deadlines, revision expectations, confidentiality and ownership before work begins. Private agreements and milestone records organise that work; access is limited by participant and administrative permissions, rather than being published in marketplace discovery.",
      "Recorded acceptance, delivery or approval is evidence of an action in the application, not a guarantee of legal enforceability, quality, payment or dispute resolution. PactAgent is separate agreement and payment infrastructure. Proposed integrations do not make escrow, refunds or settlement live Klaveroq capabilities in this beta.",
    ],
    links: [{ label: "Read the beta payment limitations", href: "/legal/payments" }],
  },
  {
    id: "content",
    title: "5. Content, confidentiality and intellectual property",
    paragraphs: [
      "Only submit content that you own or are authorised to use and disclose. Respect copyright, trade marks, confidentiality and the personal information of others. Publishing a profile or job makes the selected information visible to other people; avoid including private contact details or confidential materials in public fields.",
      "This draft does not transfer ownership of your work to Klaveroq or settle ownership between a client and freelancer. Agree those rights expressly. A narrowly scoped licence for hosting and displaying user content, any work-product transfer terms and a rights-complaint procedure require legal approval before binding terms are introduced. Contact support with the relevant item and an explanation if your rights may have been infringed.",
    ],
  },
  {
    id: "conduct",
    title: "6. Prohibited conduct and restrictions",
    paragraphs: [
      "Do not use Klaveroq for fraud, impersonation, harassment, unlawful discrimination, unlawful services, spam, malware or attempts to bypass security and access controls. Do not manipulate reviews, falsify delivery evidence or misuse another person’s information.",
      "Account restrictions, suspension or holds may limit access while security concerns, disputes or obligations are reviewed. You can request review through support; an appeal does not automatically lift a restriction or erase evidence. Information about an investigation may be limited to protect others or comply with law.",
    ],
    links: [{ label: "Community Guidelines", href: "/legal/community-guidelines" }],
  },
  {
    id: "availability",
    title: "7. Availability and beta limitations",
    paragraphs: [
      "The community beta may change, experience interruptions or contain defects. Keep your own copies of important work and agreements. Do not rely on the beta for guaranteed availability, uninterrupted delivery, insurance, identity certification or payment protection.",
      "Real payments and settlement, government-ID verification and new file uploads are not operational in the current beta. Wallet-related testing does not imply custody or protection of real funds. Any final liability allocation, warranty provisions or dispute forum must be legally reviewed; this draft does not waive statutory consumer or other mandatory rights.",
    ],
  },
  {
    id: "complaints",
    title: "8. Complaints, disputes and account closure",
    paragraphs: [
      "Use signed-in support to raise a service or conduct concern with relevant references. If you cannot sign in, use the public privacy and account-support form. Do not include passwords, secret keys or identity documents. Support review is not a promise of arbitration, a refund or a particular outcome.",
      "Eligible users can request account closure with fresh authentication and a 30-day explicit recovery window. Active obligations or holds can block closure. Necessary shared, security and historical records may remain after closure. The account-deletion notice explains the current safeguards and the beta cleanup limitation.",
    ],
    links: [
      { label: "Account Deletion & Recovery", href: "/legal/account-deletion" },
      { label: "Contact support (sign-in required)", href: "/support" },
      { label: "Public privacy and account support", href: "/account/privacy" },
    ],
  },
  {
    id: "changes",
    title: "9. Changes and formal acceptance",
    paragraphs: [
      "Each document identifies its draft version and last update. Approved terms, effective dates, operator details and an appropriate notice and acceptance process must be established before formal rollout. Existing beta accounts are not treated as having accepted new terms retrospectively. Marketing choices and any future optional tracking consent must remain separate from agreement to service terms.",
    ],
  },
];
