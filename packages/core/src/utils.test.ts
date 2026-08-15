import { describe, expect, it } from "vitest";
import { emojiToUnicode, getEmojiFromRepoDescription } from "./utils.ts";

describe("getEmojiFromRepoDescription", () => {
  it("should return emoji when emoji is with the form :emoji_name:", () => {
    expect(getEmojiFromRepoDescription(":star: Ornikar shared configs")).toBe(
      ":star:",
    );
  });
  it("should return emoji when emoji is with a unicode char", () => {
    expect(getEmojiFromRepoDescription("👨‍🎓 Ornikar shared configs")).toBe("👨‍🎓");
  });
  it("should not return any emoji when there is no emoji", () => {
    expect(getEmojiFromRepoDescription("Ornikar shared configs")).toBe("");
  });
  it("should not return any emoji when emoji is at the end of the description", () => {
    expect(getEmojiFromRepoDescription("Ornikar shared configs :star:")).toBe(
      "",
    );
    expect(getEmojiFromRepoDescription("Ornikar shared configs 👨‍🎓")).toBe("");
  });
  it("should return shortcodes containing + and -", () => {
    expect(getEmojiFromRepoDescription(":+1: Ornikar shared configs")).toBe(
      ":+1:",
    );
    expect(getEmojiFromRepoDescription(":e-mail: Ornikar shared configs")).toBe(
      ":e-mail:",
    );
  });
});

describe("emojiToUnicode", () => {
  it("should convert a shortcode to its unicode character", () => {
    expect(emojiToUnicode(":tada:")).toBe("🎉");
    expect(emojiToUnicode(":+1:")).toBe("👍");
  });
  it("should keep a unicode character as is", () => {
    expect(emojiToUnicode("👨‍🎓")).toBe("👨‍🎓");
  });
  it("should return nothing when the shortcode has no unicode character", () => {
    expect(emojiToUnicode(":shipit:")).toBe("");
  });
  it("should return nothing when there is no emoji", () => {
    expect(emojiToUnicode("")).toBe("");
    expect(emojiToUnicode(undefined)).toBe("");
  });
});
