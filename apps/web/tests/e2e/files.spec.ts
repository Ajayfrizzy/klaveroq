import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import postgres from "postgres";

const origin = "http://127.0.0.1:3199";
const password = "KlaveroqTest123";
const testDatabaseUrl =
  process.env.TEST_DATABASE_URL ??
  "postgresql://klaveroq_test:klaveroq_test@127.0.0.1:55434/klaveroq_test";
const redPixel = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Z7xoAAAAASUVORK5CYII=",
  "base64",
);
const bluePixel = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64",
);

async function activateAccount(email: string) {
  const sql = postgres(testDatabaseUrl, { max: 1 });
  await sql`update users set email_verified_at = now(), status = 'ACTIVE' where email = ${email}`;
  await sql.end();
}

async function register(page: Page, email: string, displayName: string) {
  await page.goto("/register");
  await page.getByLabel("Display name").fill(displayName);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  const responsePromise = page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/auth/register") && response.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Create account" }).click();
  const response = await responsePromise;
  expect(response.status()).toBe(201);
  await expect(page).toHaveURL(/\/verify-email/);
  await activateAccount(email);
  const session = (await response.allHeaders())["set-cookie"]
    ?.split(";")[0]
    .split("=")
    .slice(1)
    .join("=");
  expect(session).toBeTruthy();
  await page.context().addCookies([
    {
      name: "klaveroq_test_session",
      value: session!,
      url: origin,
      httpOnly: true,
      sameSite: "Lax",
      secure: false,
    },
  ]);
}

async function completeProfile(page: Page, displayName: string) {
  const response = await page.request.patch("/api/profile", {
    headers: { Origin: origin },
    data: {
      displayName,
      headline: "Accessible product engineering",
      bio: "I deliver reliable product interfaces with secure file workflows and clear evidence.",
      primaryRole: "Product engineer",
      skills: ["react", "typescript"],
      experienceLevel: "EXPERT",
      yearsExperience: 6,
      languages: ["english"],
      availability: "AVAILABLE",
      timezone: "Africa/Lagos",
      countryCode: "NG",
      preferredWorkCategories: ["DEVELOPMENT"],
      githubUrl: null,
      websiteUrl: null,
      linkedinUrl: null,
    },
  });
  expect(response.ok()).toBeTruthy();
}

async function newAccount(context: BrowserContext, email: string, name: string) {
  const page = await context.newPage();
  await register(page, email, name);
  return page;
}

test("profile media is validated, authorized, persisted, replaced, and deleted", async ({
  browser,
}) => {
  test.setTimeout(90_000);
  const suffix = Date.now();
  const ownerContext = await browser.newContext();
  const otherContext = await browser.newContext();
  const anonymousContext = await browser.newContext();
  const owner = await newAccount(ownerContext, `files-owner-${suffix}@example.test`, "File Owner");
  const other = await newAccount(otherContext, `files-other-${suffix}@example.test`, "Other User");

  const spoofed = await owner.request.post("/api/profile/avatar", {
    headers: { Origin: origin },
    multipart: {
      file: { name: "spoofed.png", mimeType: "image/png", buffer: Buffer.from("not an image") },
      altText: "Spoofed image",
    },
  });
  expect(spoofed.status()).toBe(415);
  expect((await spoofed.json()).error.code).toBe("FILE_TYPE_UNSUPPORTED");

  const oversized = Buffer.alloc(5 * 1024 * 1024 + 1, 0x20);
  redPixel.copy(oversized);
  const oversizedResponse = await owner.request.post("/api/profile/avatar", {
    headers: { Origin: origin },
    multipart: {
      file: { name: "large.png", mimeType: "image/png", buffer: oversized },
      altText: "Oversized image",
    },
  });
  expect(oversizedResponse.status()).toBe(413);

  await owner.goto("/profile");
  await owner.getByRole("button", { name: "Edit profile" }).click();
  await expect(owner.getByRole("button", { name: "Cancel" })).toBeVisible();
  await owner.getByRole("button", { name: "Cancel" }).click();
  const avatarControl = owner.locator(".profile-media-control");
  await avatarControl.locator('input[type="file"]').setInputFiles({
    name: "avatar.png",
    mimeType: "image/png",
    buffer: redPixel,
  });
  await avatarControl.getByLabel("Alternative text").fill("File Owner profile photo");
  const avatarUpload = owner.waitForResponse(
    (response) =>
      response.url().endsWith("/api/profile/avatar") && response.request().method() === "POST",
  );
  await avatarControl.getByRole("button", { name: "Upload", exact: true }).click();
  expect((await avatarUpload).status()).toBe(201);
  await expect(owner.getByAltText("File Owner profile photo")).toBeVisible();

  const ownerId = new URL(
    (await owner.getByAltText("File Owner profile photo").getAttribute("src"))!,
    origin,
  ).pathname
    .split("/")
    .at(-1)!;
  expect((await anonymousContext.request.get(`/api/media/avatar/${ownerId}`)).status()).toBe(404);

  await avatarControl.locator('input[type="file"]').setInputFiles({
    name: "replacement.png",
    mimeType: "image/png",
    buffer: bluePixel,
  });
  await avatarControl.getByLabel("Alternative text").fill("Replacement profile photo");
  const avatarReplacement = owner.waitForResponse(
    (response) =>
      response.url().endsWith("/api/profile/avatar") && response.request().method() === "POST",
  );
  await avatarControl.getByRole("button", { name: "Upload", exact: true }).click();
  expect((await avatarReplacement).status()).toBe(201);
  await owner.reload();
  await expect(owner.getByAltText("Replacement profile photo")).toBeVisible();

  await completeProfile(owner, "File Owner");
  const publish = await owner.request.patch("/api/profile/visibility", {
    headers: { Origin: origin },
    data: { isPublic: true },
  });
  expect(publish.ok()).toBeTruthy();
  expect((await anonymousContext.request.get(`/api/media/avatar/${ownerId}`)).status()).toBe(200);

  const portfolioResponse = await owner.request.post("/api/profile/portfolio", {
    headers: { Origin: origin, "Idempotency-Key": crypto.randomUUID() },
    data: {
      title: "Secure uploads",
      description: "A project demonstrating validated and authorized file delivery.",
      projectUrl: null,
      githubUrl: null,
      skills: ["security", "typescript"],
      projectRole: "Lead engineer",
    },
  });
  expect(portfolioResponse.status()).toBe(201);
  const portfolioId = (await portfolioResponse.json()).data.id as string;

  const unauthorized = await other.request.post(`/api/profile/portfolio/${portfolioId}/media`, {
    headers: { Origin: origin },
    multipart: {
      file: { name: "stolen.png", mimeType: "image/png", buffer: redPixel },
      altText: "Unauthorized replacement",
    },
  });
  expect(unauthorized.status()).toBe(404);

  const infectedPdf = Buffer.from(
    "%PDF-1.7\nX5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE",
  );
  const infected = await owner.request.post(`/api/profile/portfolio/${portfolioId}/media`, {
    headers: { Origin: origin },
    multipart: {
      file: { name: "infected.pdf", mimeType: "application/pdf", buffer: infectedPdf },
      altText: "Infected document",
    },
  });
  expect(infected.status()).toBe(422);
  expect((await infected.json()).error.code).toBe("FILE_INFECTED");

  await owner.goto("/profile");
  const portfolioCard = owner.locator(".portfolio-list > article").filter({
    hasText: "Secure uploads",
  });
  await portfolioCard.getByRole("button", { name: "Edit Secure uploads" }).click();
  await owner.locator(".portfolio-form").getByRole("button", { name: "Cancel" }).click();
  await portfolioCard.locator('input[type="file"]').setInputFiles({
    name: "project.png",
    mimeType: "image/png",
    buffer: redPixel,
  });
  await portfolioCard.getByLabel("Alternative text").fill("Secure upload project preview");
  const portfolioUpload = owner.waitForResponse(
    (response) =>
      response.url().endsWith(`/api/profile/portfolio/${portfolioId}/media`) &&
      response.request().method() === "POST",
  );
  await portfolioCard.getByRole("button", { name: "Upload", exact: true }).click();
  expect((await portfolioUpload).status()).toBe(201);
  await expect(owner.getByAltText("Secure upload project preview")).toBeVisible();
  expect((await anonymousContext.request.get(`/api/media/portfolio/${portfolioId}`)).status()).toBe(
    200,
  );

  const portfolioRemoval = owner.waitForResponse(
    (response) =>
      response.url().endsWith(`/api/profile/portfolio/${portfolioId}/media`) &&
      response.request().method() === "DELETE",
  );
  await portfolioCard.getByRole("button", { name: "Remove project media" }).click();
  expect((await portfolioRemoval).status()).toBe(204);
  expect((await owner.request.get(`/api/media/portfolio/${portfolioId}`)).status()).toBe(404);
  const avatarRemoval = owner.waitForResponse(
    (response) =>
      response.url().endsWith("/api/profile/avatar") && response.request().method() === "DELETE",
  );
  await owner
    .locator(".profile-media-control")
    .getByRole("button", { name: "Remove profile photo" })
    .click();
  expect((await avatarRemoval).status()).toBe(204);
  expect((await owner.request.get(`/api/media/avatar/${ownerId}`)).status()).toBe(404);

  await ownerContext.close();
  await otherContext.close();
  await anonymousContext.close();
});
