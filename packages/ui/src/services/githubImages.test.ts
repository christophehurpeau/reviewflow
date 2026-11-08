import { describe, expect, it } from "vitest";
import { imageSourceOf } from "./githubImages.tsx";

const camo = "https://camo.githubusercontent.com/abc/def";

describe("imageSourceOf", () => {
  it("loads an image through its camo url", () => {
    expect(
      imageSourceOf("https://tracker.test/pixel.png", {
        "https://tracker.test/pixel.png": camo,
      }),
    ).toBe(camo);
  });

  it("loads an image GitHub hosts as it is", () => {
    for (const src of [
      "https://github.com/user-attachments/assets/1",
      "https://user-images.githubusercontent.com/1/a.png",
    ]) {
      expect(imageSourceOf(src, {})).toBe(src);
    }
  });

  it("loads nothing from another host, nor over http, nor from a look-alike", () => {
    for (const src of [
      "https://tracker.test/pixel.png",
      "http://github.com/a.png",
      "https://evilgithub.com/a.png",
      "https://github.com.evil.test/a.png",
    ]) {
      expect(imageSourceOf(src, {})).toBeNull();
    }
  });
});
