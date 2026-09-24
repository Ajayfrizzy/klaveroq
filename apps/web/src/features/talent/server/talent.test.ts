import { describe, expect, it } from "vitest";
import { canModifyPortfolio, canViewTalentProfile } from "./authorization";
import { assertProfileCanBePublished, getMissingPublicationFields } from "./publication";
import { toPublicPortfolioItem, toPublicTalentProfile, type ProfileRecord } from "./public-profile";
import { portfolioInputSchema, profileInputSchema, talentQuerySchema } from "./schemas";

describe("talent profiles", () => {
  it("projects only intentional public profile fields", () => {
    const profile = {
      userId: "user-1",
      displayName: "Maya Chen",
      headline: "Frontend engineer",
      bio: "A sufficiently complete public professional biography for testing.",
      primaryRole: "Frontend engineering",
      skills: ["react"],
      experienceLevel: "EXPERT",
      yearsExperience: 8,
      languages: ["english"],
      availability: "AVAILABLE",
      preferredWorkCategories: ["DEVELOPMENT"],
      countryCode: "NG",
      timezone: "Africa/Lagos",
      avatarKey: "private/storage/avatar-key",
      githubUrl: null,
      websiteUrl: null,
      linkedinUrl: null,
      isPublic: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as ProfileRecord;
    const publicProfile = toPublicTalentProfile(profile);
    expect(publicProfile.displayName).toBe("Maya Chen");
    expect(publicProfile).not.toHaveProperty("avatarKey");
    expect(publicProfile).not.toHaveProperty("isPublic");
  });

  it("does not expose internal portfolio storage references", () => {
    const item = toPublicPortfolioItem({
      id: "item-1",
      userId: "user-1",
      title: "Dashboard",
      description: "An accessible reporting dashboard delivered for a financial product.",
      projectUrl: null,
      githubUrl: null,
      mediaKey: "private/storage/media-key",
      skills: ["react"],
      projectRole: "Engineer",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    expect(item).not.toHaveProperty("mediaKey");
    expect(item).not.toHaveProperty("userId");
  });

  it("enforces portfolio ownership", () => {
    expect(canModifyPortfolio("owner", "owner")).toBe(true);
    expect(canModifyPortfolio("owner", "other-user")).toBe(false);
  });

  it("keeps private profiles hidden while allowing owner preview", () => {
    expect(canViewTalentProfile(false, "owner")).toBe(false);
    expect(canViewTalentProfile(false, "owner", "other-user")).toBe(false);
    expect(canViewTalentProfile(false, "owner", "owner")).toBe(true);
    expect(canViewTalentProfile(true, "owner")).toBe(true);
  });

  it("normalizes professional profile and discovery inputs", () => {
    const profile = profileInputSchema.parse({
      displayName: "Maya Chen",
      headline: "Frontend engineer",
      bio: "I deliver accessible applications with reviewable, documented milestones.",
      primaryRole: "Frontend engineering",
      skills: ["React", "react", "TypeScript"],
      experienceLevel: "EXPERT",
      yearsExperience: 8,
      languages: ["English"],
      availability: "AVAILABLE",
      timezone: "Africa/Lagos",
      countryCode: "ng",
      preferredWorkCategories: ["DEVELOPMENT"],
      githubUrl: "",
      websiteUrl: "",
      linkedinUrl: "",
    });
    expect(profile.skills).toEqual(["react", "typescript"]);
    expect(profile.countryCode).toBe("NG");
    expect(profile.githubUrl).toBeNull();
    expect(talentQuerySchema.parse({ minCompletedJobs: "5" }).minCompletedJobs).toBe(5);
    expect(() =>
      portfolioInputSchema.parse({ title: "x", description: "short", skills: [] }),
    ).toThrow();
  });

  it("accepts bounded partial private-profile edits without inventing defaults", () => {
    expect(profileInputSchema.parse({ displayName: "Updated name" })).toEqual({
      displayName: "Updated name",
    });
    expect(
      profileInputSchema.parse({
        headline: "",
        bio: "",
        primaryRole: "",
        experienceLevel: null,
        countryCode: "",
        timezone: "",
      }),
    ).toEqual({
      headline: null,
      bio: null,
      primaryRole: null,
      experienceLevel: null,
      countryCode: null,
      timezone: null,
    });
  });

  it("rejects target identifiers, oversized values, and unsafe profile URLs", () => {
    expect(() =>
      profileInputSchema.parse({ displayName: "Owner", userId: "another-user" }),
    ).toThrow();
    expect(() => profileInputSchema.parse({ headline: "x".repeat(161) })).toThrow();
    expect(() => profileInputSchema.parse({ websiteUrl: "javascript:alert(1)" })).toThrow();
  });

  it("rejects incomplete profiles and allows complete profiles to be published", () => {
    const incomplete = {
      displayName: "Maya Chen",
      headline: null,
      primaryRole: null,
      bio: null,
      skills: [],
      experienceLevel: null,
      countryCode: null,
      timezone: null,
    };
    expect(getMissingPublicationFields(incomplete)).toEqual([
      "professional headline",
      "primary role",
      "professional bio",
      "at least one skill",
      "experience level",
      "country",
      "timezone",
    ]);
    expect(() => assertProfileCanBePublished(incomplete)).toThrow(
      /Complete your profile before publishing/,
    );
    expect(() =>
      assertProfileCanBePublished({
        ...incomplete,
        headline: "Accessible frontend engineer",
        primaryRole: "Frontend engineering",
        bio: "I deliver accessible applications with clear, reviewable milestones.",
        skills: ["typescript"],
        experienceLevel: "EXPERT",
        countryCode: "NG",
        timezone: "Africa/Lagos",
      }),
    ).not.toThrow();
  });
});
