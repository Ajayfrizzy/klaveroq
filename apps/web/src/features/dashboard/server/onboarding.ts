export type OnboardingSignals = {
  hasAgreement: boolean;
  hasListing: boolean;
  hasProposal: boolean;
  hasPortfolioItem: boolean;
  profileIsPublic: boolean;
};

export function isFirstTimeUser(signals: OnboardingSignals) {
  return !Object.values(signals).some(Boolean);
}
