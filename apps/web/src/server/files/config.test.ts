import { describe, expect, it } from "vitest";
import { objectStorageConfiguration, s3Configuration } from "./config";

const env = {
  FILE_STORAGE_BACKEND: "s3",
  S3_ENDPOINT: "https://objects.example.test/",
  S3_REGION: "us-east-1",
  S3_BUCKET: "private-files",
  S3_PREFIX: "community-beta/",
  S3_ACCESS_KEY_ID: "test-key",
  S3_SECRET_ACCESS_KEY: "test-secret",
};

describe("S3-compatible provider configuration", () => {
  it("uses explicit provider credentials, region and addressing settings", () => {
    expect(objectStorageConfiguration({ ...env, S3_FORCE_PATH_STYLE: "true" })).toMatchObject({
      endpoint: "https://objects.example.test",
      region: "us-east-1",
      credentials: { accessKeyId: "test-key", secretAccessKey: "test-secret" },
      forcePathStyle: true,
      privateAcl: false,
    });
  });
  it.each([
    { S3_ENDPOINT: "http://objects.example.test" },
    { S3_ENDPOINT: "https://user:password@objects.example.test" },
    { S3_ENDPOINT: "https://objects.example.test/bucket" },
    { S3_ENDPOINT: "https://objects.example.test?token=secret" },
    { S3_ENDPOINT: "invalid" },
    { S3_REGION: "" },
    { S3_SECRET_ACCESS_KEY: "" },
    { S3_BUCKET: "" },
    { S3_PREFIX: "../" },
    { S3_FORCE_PATH_STYLE: "yes" },
    { S3_PRIVATE_ACL: "yes" },
  ])("rejects incomplete or invalid settings: %j", (override) => {
    expect(() => s3Configuration({ ...env, ...override })).toThrow();
  });
  it("does not reuse Spaces credentials for another provider", () => {
    expect(() =>
      s3Configuration({
        ...env,
        S3_ACCESS_KEY_ID: "",
        SPACES_ACCESS_KEY_ID: "spaces-key",
      }),
    ).toThrow();
  });
});
