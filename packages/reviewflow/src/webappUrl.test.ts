import { afterEach, describe, expect, it, vi } from "vitest";
import { checkWebappUrlConfig, orgSettingsUrl } from "./webappUrl.ts";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("orgSettingsUrl", () => {
  it("points at the org screen of the webapp", () => {
    vi.stubEnv("REVIEWFLOW_APP_URL", "https://reviewflow.example");

    expect(orgSettingsUrl("acme")).toBe("https://reviewflow.example/org/acme");
  });

  it("ignores a trailing slash", () => {
    vi.stubEnv("REVIEWFLOW_APP_URL", "https://reviewflow.example/");

    expect(orgSettingsUrl("acme")).toBe("https://reviewflow.example/org/acme");
  });
});

describe("checkWebappUrlConfig", () => {
  it("passes on the url of the webapp", () => {
    vi.stubEnv("REVIEWFLOW_APP_URL", "https://reviewflow.example");

    expect(() => {
      checkWebappUrlConfig();
    }).not.toThrow();
  });

  it("rejects the url the screens used to be served on", () => {
    vi.stubEnv("REVIEWFLOW_APP_URL", "https://reviewflow.example/app");

    expect(() => {
      checkWebappUrlConfig();
    }).toThrow("the webapp is served at the root");
  });

  it("rejects a missing url", () => {
    vi.stubEnv("REVIEWFLOW_APP_URL", "");

    expect(() => {
      checkWebappUrlConfig();
    }).toThrow("Missing env variable");
  });
});
