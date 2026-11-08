import { describe, expect, it } from "vitest";
import { fileKindOf } from "./file-kind.ts";

describe("fileKindOf", () => {
  it.each([
    ["packages/sdk/src/index.ts", "typescript"],
    ["packages/sdk/src/index.d.mts", "typescript"],
    ["packages/ui/src/screen.tsx", "tsx"],
    ["scripts/build.mjs", "javascript"],
    ["src/App.jsx", "jsx"],
    ["tsconfig.json", "json"],
    ["README.md", "markdown"],
    ["src/global.css", "css"],
    ["public/index.html", "html"],
    ["assets/logo.PNG", "image"],
    ["assets/logo.svg", "svg"],
    [".github/workflows/ci.yml", "config"],
    ["scripts/release.sh", "shell"],
    ["migrations/001.sql", "sql"],
    ["tools/gen.py", "python"],
    ["src/main.rs", "rust"],
    ["src/App.vue", "vue"],
    ["NOTES.txt", "text"],
  ] as const)("reads %s as %s from its extension", (path, kind) => {
    expect(fileKindOf(path)).toBe(kind);
  });

  it("reads a manifest and lockfiles before their extension", () => {
    expect(fileKindOf("packages/ui/package.json")).toBe("package");
    expect(fileKindOf("pnpm-lock.yaml")).toBe("lock");
    expect(fileKindOf("package-lock.json")).toBe("lock");
    expect(fileKindOf("Cargo.lock")).toBe("lock");
  });

  it("reads a dotfile without known extension as config", () => {
    expect(fileKindOf(".gitignore")).toBe("config");
    expect(fileKindOf("packages/app/.npmrc")).toBe("config");
    expect(fileKindOf(".eslintrc.json")).toBe("json");
  });

  it("falls back to a plain file", () => {
    expect(fileKindOf("LICENSE")).toBe("file");
    expect(fileKindOf("assets/font.woff2")).toBe("file");
  });
});
