import type { PolicySection } from "../registry";
export const payments: PolicySection[] = [
  {
    id: "beta",
    title: "1. No live payment service in the community beta",
    paragraphs: [
      "Real payments, escrow funding, refunds and settlement are not yet operational in Klaveroq’s community beta. This is a draft launch-information notice, not an active payment-service agreement. Do not send real funds on the assumption that a beta screen, wallet test or recorded milestone protects a payment.",
      "PactAgent is separate agreement and payment infrastructure. Proposed or simulated connections do not establish a live Klaveroq escrow service, regulated custody arrangement or guaranteed payment protection. Government-ID verification is also not operational in this beta.",
    ],
  },
  {
    id: "records",
    title: "2. Agreements, test wallets and records",
    paragraphs: [
      "Jobs, proposals, private agreements and milestone records help participants organise work. Invitation acceptance, agreement acceptance and delivery status do not themselves transfer money. Wallet ownership testing may prove control of a test address; it does not prove legal identity, creditworthiness, available funds or an entitlement to payment.",
      "Amounts, fee estimates and test operation references shown in the product are not evidence that real funds have been received, reserved, released or refunded. Keep your own agreed work records and contact support if a display is unclear.",
    ],
  },
  {
    id: "fees",
    title: "3. Proposed fees — not binding beta charges",
    paragraphs: [
      "The current estimate code models a proposed 3% client fee and 2% worker fee. The client fee is added to the work subtotal; the worker fee is deducted from that subtotal when estimating the worker’s net amount. A separate estimated network reserve may also appear. Estimates use smallest-unit rounding and are not a final statement of taxes, currency conversion or network costs.",
      "Formal operator and legal approval of these fees has not been established for this draft. The figures are proposals reflected in estimate code, not binding payment terms or a charge collected by this notice. Creating Client Invites or proposals is not a fee-triggering event. Final pricing, rounding, asset support, taxes, cancellation treatment and disclosures must be approved before live payments.",
    ],
  },
  {
    id: "refunds",
    title: "4. Refunds, disputes and limitations",
    paragraphs: [
      "Because the beta does not operate real funding or settlement, it does not provide a live platform refund process. Support and dispute records can document a concern but do not guarantee arbitration, reversal of a transfer, insurance, payment protection or a refund within a stated time.",
      "This draft does not grant a payment-services licence, claim regulatory authorisation or remove rights under applicable law. A mistaken transfer or a separate arrangement outside the beta is not automatically recoverable by Klaveroq. Do not share private keys or recovery phrases when contacting support.",
    ],
  },
  {
    id: "launch",
    title: "5. Before live payments launch",
    paragraphs: [
      "The operator must review provider contracts and roles, applicable regulatory requirements, supported countries and assets, identity requirements, custody and fund flows, fees, taxes, settlement conditions, dispute handling, refund rules and record retention. The policy must then be updated with verified provider information and an approved effective date before live functionality is offered.",
      "Users must receive appropriate notice and any required acceptance process for the approved terms. Existing beta use is not treated as advance acceptance of future financial terms.",
    ],
    links: [
      { label: "Contact support (sign-in required)", href: "/support" },
      { label: "Public account-support form", href: "/account/privacy" },
      { label: "Terms of Service draft", href: "/legal/terms" },
    ],
  },
];
