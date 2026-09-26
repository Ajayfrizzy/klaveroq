import type { mediaFiles, portfolioItems, profiles } from "@/server/db/schema";

export type ProfileRecord = typeof profiles.$inferSelect;

type MediaRecord = typeof mediaFiles.$inferSelect;

export function toPublicTalentProfile(profile: ProfileRecord, avatar?: MediaRecord) {
  return {
    userId: profile.userId,
    displayName: profile.displayName,
    headline: profile.headline,
    bio: profile.bio,
    primaryRole: profile.primaryRole,
    skills: profile.skills,
    experienceLevel: profile.experienceLevel,
    yearsExperience: profile.yearsExperience,
    languages: profile.languages,
    availability: profile.availability,
    preferredWorkCategories: profile.preferredWorkCategories,
    countryCode: profile.countryCode,
    timezone: profile.timezone,
    githubUrl: profile.githubUrl,
    websiteUrl: profile.websiteUrl,
    linkedinUrl: profile.linkedinUrl,
    avatarUrl: avatar ? `/api/media/avatar/${profile.userId}` : null,
    avatarAltText: avatar?.altText ?? null,
    createdAt: profile.createdAt,
    updatedAt: profile.updatedAt,
  };
}

export function toPublicPortfolioItem(
  item: typeof portfolioItems.$inferSelect,
  media?: MediaRecord,
) {
  return {
    id: item.id,
    title: item.title,
    description: item.description,
    projectUrl: item.projectUrl,
    githubUrl: item.githubUrl,
    skills: item.skills,
    projectRole: item.projectRole,
    mediaUrl: media ? `/api/media/portfolio/${item.id}` : null,
    mediaAltText: media?.altText ?? null,
    mediaContentType: media?.contentType ?? null,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  };
}
