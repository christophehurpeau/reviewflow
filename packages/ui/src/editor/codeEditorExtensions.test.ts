import { describe, expect, it } from "vitest";
import { codeLanguageOfPath } from "./codeEditorExtensions.ts";

describe("codeLanguageOfPath", () => {
  it("picks the language by extension, whatever its case", () => {
    expect(codeLanguageOfPath("src/index.ts")).toBe("typescript");
    expect(codeLanguageOfPath("src/App.TSX")).toBe("tsx");
    expect(codeLanguageOfPath("README.md")).toBe("markdown");
    expect(codeLanguageOfPath(".github/workflows/ci.yml")).toBe("yaml");
  });

  it("is plain text for an unknown extension, a dotfile or no extension", () => {
    expect(codeLanguageOfPath("main.rs")).toBe("plain");
    expect(codeLanguageOfPath(".gitignore")).toBe("plain");
    expect(codeLanguageOfPath("Makefile")).toBe("plain");
    expect(codeLanguageOfPath("dir.d/file")).toBe("plain");
  });
});
