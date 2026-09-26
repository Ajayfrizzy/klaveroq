import { ApiError } from "@/server/http/errors";
import { jobBuilderOutputSchema, proposalAssistantOutputSchema } from "../schemas";
import type { ProposalAssistantContext } from "../types";
import { TemplateMarketplaceAiProvider } from "./template-provider";
import type { MarketplaceAiProvider } from "./provider";

const providers: Record<string, MarketplaceAiProvider> = {
  template: new TemplateMarketplaceAiProvider(),
};

function provider() {
  const name = process.env.MARKETPLACE_AI_PROVIDER ?? "template";
  const selected = providers[name];
  if (!selected)
    throw new ApiError(503, "AI_PROVIDER_UNAVAILABLE", "Marketplace assistance is unavailable.");
  return selected;
}

export async function buildJobSuggestion(description: string) {
  return jobBuilderOutputSchema.parse(await provider().buildJob(description));
}

export async function buildProposalSuggestion(
  context: ProposalAssistantContext,
  emphasis?: string,
) {
  return proposalAssistantOutputSchema.parse(await provider().buildProposal(context, emphasis));
}
