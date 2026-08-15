import { afterEach, describe, expect, it, vi } from "vitest";
import type * as WebappUrl from "./webappUrl.ts";

const importWebappUrl = async (): Promise<typeof WebappUrl> => {
  vi.resetModules();
  return import("./webappUrl.ts");
};

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("webappUrl", () => {
  it("builds an url of the webapp", async () => {
    vi.stubEnv("REVIEWFLOW_APP_URL", "https://reviewflow.example");
    const { webappUrl } = await importWebappUrl();

    expect(webappUrl("/org/acme")).toBe("https://reviewflow.example/org/acme");
    expect(webappUrl("/", { error: "nope" })).toBe(
      "https://reviewflow.example/?error=nope",
    );
  });

  it("refuses the url the screens used to be served on, which the redirects would loop on", async () => {
    vi.stubEnv("REVIEWFLOW_APP_URL", "https://reviewflow.example/app");

    await expect(importWebappUrl()).rejects.toThrow(
      "the webapp is served at the root",
    );
  });
});
