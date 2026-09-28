import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/components/ui/use-work-protection", () => ({
  useWorkProtection: () => ({ root: null, markSaved: vi.fn() }),
}));
import { UploadAvailabilityProvider } from "./upload-availability";
import { MediaUploader } from "./media-uploader";
import { AgreementActions } from "@/features/jobs/components/agreement-actions";
import { DisputeWorkspace } from "@/features/jobs/components/dispute-workspace";

const render = (children: React.ReactNode) =>
  renderToStaticMarkup(
    <UploadAvailabilityProvider enabled={false}>{children}</UploadAvailabilityProvider>,
  );
function expectDisabledFileInputs(html: string) {
  const inputs = html.match(/<input[^>]+type="file"[^>]*>/g) ?? [];
  expect(inputs.length).toBeGreaterThan(0);
  for (const input of inputs) expect(input).toContain('disabled=""');
  expect(html).toContain("Uploads will become available later.");
}
describe("disabled upload controls", () => {
  it("removes avatar/portfolio pickers, upload and remove controls without invoking mutation callbacks", () => {
    const onChange = vi.fn();
    const html = render(
      <MediaUploader
        endpoint="/api/profile/avatar"
        label="photo"
        accept="image/png"
        initialMedia={{
          url: "/api/media/avatar/owner",
          altText: "Existing",
          contentType: "image/png",
        }}
        onChange={onChange}
      />,
    );
    expect(html).not.toContain('type="file"');
    expect(html).not.toContain("<button");
    expect(html).toContain("Uploads will become available later.");
    expect(onChange).not.toHaveBeenCalled();
  });
  it("disables proof pickers while preserving text/links and submit controls", () => {
    const html = render(
      <AgreementActions
        jobId="job"
        userId="worker"
        role="worker"
        status="IN_PROGRESS"
        milestones={[
          {
            id: "milestone",
            title: "Milestone",
            status: "ACTIVE",
            latestProof: { id: "proof", note: "Text", links: [], version: 1, files: [] },
          },
          {
            id: "review",
            title: "Review",
            status: "UNDER_REVIEW",
            latestProof: { id: "proof-review", note: "Text", links: [], version: 1, files: [] },
          },
        ]}
      />,
    );
    expectDisabledFileInputs(html);
    expect(html).toContain("Completion note");
    expect(html).toContain("Evidence links");
    expect(html).toContain("Submit proof");
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>[\s\S]*?Upload files/);
  });
  it("disables dispute attachments while keeping the evidence note form", () => {
    const html = render(
      <DisputeWorkspace
        disputes={[
          {
            id: "dispute",
            reference: "D-TEST",
            status: "OPEN",
            reasonCode: "OTHER",
            description: "Existing dispute",
            createdAt: new Date().toISOString(),
            evidenceDueAt: new Date(Date.now() + 86_400_000).toISOString(),
            evidence: [],
            events: [],
          },
        ]}
      />,
    );
    expectDisabledFileInputs(html);
    expect(html).toContain("Evidence note");
    expect(html).toContain("Submit evidence");
  });
});
