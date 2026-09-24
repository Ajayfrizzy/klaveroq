import { ApiError } from "../../../server/http/errors";

type PublicationProfile = {
  displayName: string;
  headline: string | null;
  primaryRole: string | null;
  bio: string | null;
  skills: string[];
  experienceLevel: string | null;
  countryCode: string | null;
  timezone: string | null;
};

export function getMissingPublicationFields(profile: PublicationProfile) {
  const missing: string[] = [];
  if (profile.displayName.trim().length < 2) missing.push("display name");
  if (!profile.headline?.trim() || profile.headline.trim().length < 5)
    missing.push("professional headline");
  if (!profile.primaryRole?.trim() || profile.primaryRole.trim().length < 2)
    missing.push("primary role");
  if (!profile.bio?.trim() || profile.bio.trim().length < 40) missing.push("professional bio");
  if (!profile.skills.some((skill) => skill.trim())) missing.push("at least one skill");
  if (!profile.experienceLevel) missing.push("experience level");
  if (profile.countryCode?.trim().length !== 2) missing.push("country");
  if (!profile.timezone?.trim() || profile.timezone.trim().length < 2) missing.push("timezone");
  return missing;
}

export function assertProfileCanBePublished(profile: PublicationProfile) {
  const missingFields = getMissingPublicationFields(profile);
  if (missingFields.length)
    throw new ApiError(
      422,
      "PROFILE_INCOMPLETE",
      `Complete your profile before publishing. Add: ${missingFields.join(", ")}.`,
      { missingFields },
    );
}
