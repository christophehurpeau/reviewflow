import { describe, expect, it } from "vitest";
import { isSafeUrl } from "./safe-url.ts";

describe("isSafeUrl", () => {
  it("accepts web and mail links", () => {
    expect(isSafeUrl("https://github.com/a/b")).toBe(true);
    expect(isSafeUrl("mailto:a@b.c")).toBe(true);
  });

  it("refuses scripts, relative urls and garbage", () => {
    // eslint-disable-next-line no-script-url
    expect(isSafeUrl("javascript:alert(1)")).toBe(false);
    expect(isSafeUrl(" JaVaScRiPt:alert(1)")).toBe(false);
    expect(isSafeUrl("/relative.png")).toBe(false);
    expect(isSafeUrl("")).toBe(false);
  });

  it("takes the protocols a caller allows", () => {
    expect(isSafeUrl("mailto:a@b.c", ["https:"])).toBe(false);
  });
});
