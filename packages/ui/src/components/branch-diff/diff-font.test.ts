import { describe, expect, it } from "vitest";
import { diffFontCSS, diffFontFamily } from "./diff-font.ts";

describe("diffFontFamily", () => {
  it("is alouette's mono, or pierre's own", () => {
    expect(diffFontFamily("alouette", "Fira Code")).toBe("var(--font-mono)");
    expect(diffFontFamily("pierre", "Fira Code")).toBeNull();
  });

  it("puts a custom font before alouette's mono", () => {
    expect(diffFontFamily("custom", ' "JetBrains Mono", Menlo ')).toBe(
      '"JetBrains Mono", Menlo, var(--font-mono)',
    );
  });

  it("is alouette's mono for an empty custom font", () => {
    expect(diffFontFamily("custom", "  ")).toBe("var(--font-mono)");
  });

  it("drops what would escape the declaration", () => {
    expect(
      diffFontCSS(diffFontFamily("custom", "Iosevka; } :host { color: red /*")),
    ).toBe(
      ":host { --diffs-font-family: Iosevka  :host  color: red, var(--font-mono); }",
    );
  });
});
