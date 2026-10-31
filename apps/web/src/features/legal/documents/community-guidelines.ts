import type { PolicySection } from "../registry";
export const communityGuidelines: PolicySection[] = [
  {
    id: "purpose",
    title: "1. A professional marketplace",
    paragraphs: [
      "These proposed guidelines explain the conduct expected of clients and freelancers. They are a draft for review, not a claim that every moderation process described here is automated or fully staffed. Existing security and account restrictions continue to apply.",
    ],
  },
  {
    id: "honesty",
    title: "2. Represent yourself and your work honestly",
    paragraphs: [
      "Use accurate profiles, skills, availability and experience. Do not impersonate a person or organisation, fabricate qualifications, manipulate reviews or misrepresent your authority to hire. Email verification and wallet ownership checks are not endorsements of skills, identity or trustworthiness.",
      "Post genuine opportunities with understandable scope and realistic expectations. Do not advertise misleading budgets, hide material requirements or use proposals and invitations to harvest personal information. Agree changes to scope, deadlines and ownership with the other participant rather than falsifying records.",
    ],
  },
  {
    id: "respect",
    title: "3. Respect and lawful participation",
    paragraphs: [
      "Harassment, threats, hateful abuse, unlawful discrimination, sexual exploitation and disclosure of another person’s private information are unacceptable. Communicate professionally even when work or payment expectations are disputed. Respect intellectual property and confidentiality.",
      "Do not offer or request unlawful services, fraudulent documents, scams or work intended to harm others. Do not upload or transmit malware, probe accounts without authority, evade restrictions or attempt to bypass security controls. Do not send spam, bulk unsolicited Client Invites or misleading links.",
    ],
  },
  {
    id: "work",
    title: "4. Responsibilities during work",
    paragraphs: [
      "Clients should clarify deliverables, supply necessary authorised materials and review submissions honestly. Freelancers should communicate availability and delays, protect client information and submit genuine work they are entitled to provide. Both parties should keep records of agreed changes and raise concerns promptly.",
      "Do not pressure another person to share credentials, recovery codes, private keys or identity documents. Real payment, escrow, refund and settlement services are not operational in the beta. Do not represent a test wallet, milestone status or proposed integration as proof that real money is protected.",
    ],
    links: [{ label: "Beta payment limitations", href: "/legal/payments" }],
  },
  {
    id: "reports",
    title: "5. Reports and moderation",
    paragraphs: [
      "Report concerns through signed-in support with the relevant job, invitation or message reference and a factual explanation. If access is restricted, the public privacy and account-support form remains available. Include only necessary evidence and avoid reposting harmful or private content. The support route is not an emergency service; contact appropriate emergency services for immediate threats.",
      "Authorised staff can review relevant records and use account restrictions or holds to protect participants and evidence. A report does not itself establish wrongdoing or guarantee a specific outcome. Moderation may require additional information; some details cannot be disclosed where they would expose another person’s information or compromise an investigation.",
    ],
    links: [
      { label: "Report through support (sign-in required)", href: "/support" },
      { label: "Help when you cannot sign in", href: "/account/privacy" },
    ],
  },
  {
    id: "review",
    title: "6. Review and appeals",
    paragraphs: [
      "If you believe a restriction is mistaken, request review through support or the public account-support form. Identify the decision or reference, explain the issue and provide relevant new information without creating another account to evade the restriction. A review request does not automatically lift a hold or restore access.",
      "A formal moderation escalation process, response targets and notice rules require operator approval. This draft does not promise independent arbitration, a fixed appeal outcome or unlimited access while legal or safety concerns remain unresolved. It does not remove any rights available under applicable law.",
    ],
  },
];
