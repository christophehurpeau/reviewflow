import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { importSpecifiers, readReadingOrder } from "./readingOrder.ts";
import type { GitRepoFixture } from "./test/gitRepo.ts";
import { createGitRepo } from "./test/gitRepo.ts";

describe("importSpecifiers", () => {
  it("lists imports, type imports, re-exports and literal dynamic imports in source order", () => {
    const source = [
      'import type { A } from "./types.ts";',
      "// é, so a span counted in bytes would be off",
      'export { b } from "./b.ts";',
      'export * from "./c.ts";',
      'import "./side-effect.ts";',
      'const lazy = () => import("./lazy.tsx");',
      // oxlint-disable-next-line @pob/no-useless-template-literal -- a string literal would trip no-template-curly-in-string
      `const dynamic = (name: string) => import(\`./\${name}.ts\`);`,
      'import { a } from "./types.ts";',
      'import React from "react";',
    ].join("\n");
    expect(importSpecifiers("x.ts", source)).toEqual([
      "./types.ts",
      "./b.ts",
      "./c.ts",
      "./side-effect.ts",
      "./lazy.tsx",
      "react",
    ]);
  });

  it("keeps what was parsed before a syntax error", () => {
    expect(
      importSpecifiers("x.tsx", 'import { a } from "./a";\nconst = ;'),
    ).toEqual(["./a"]);
  });
});

describe("readReadingOrder", () => {
  let repo: GitRepoFixture;

  beforeEach(() => {
    repo = createGitRepo();
  });

  afterEach(() => {
    repo.remove();
  });

  const write = (path: string, content: string): void => {
    mkdirSync(dirname(join(repo.path, path)), { recursive: true });
    writeFileSync(join(repo.path, path), content);
  };

  const commitAll = (): string => {
    repo.git(["add", "-A"]);
    repo.commit();
    return repo.git(["rev-parse", "HEAD"]).trim();
  };

  it("orders the packages by dependency and the files from the entry point, through a subpath import and an unchanged barrel", async () => {
    write("package.json", '{ "name": "root" }');
    write("packages/sdk/package.json", '{ "name": "@acme/sdk" }');
    write("packages/sdk/src/index.ts", 'export * from "./format.js";\n');
    write("packages/sdk/src/format.ts", "export const format = 1;\n");
    write(
      "packages/ui/package.json",
      '{ "name": "@acme/ui", "imports": { "#/*": "./src/*" }, "dependencies": { "@acme/sdk": "workspace:*" } }',
    );
    write("packages/ui/src/screen.tsx", 'import { x } from "#/lib";\n');
    write("packages/ui/src/lib/index.ts", 'export * from "./row.tsx";\n');
    write("packages/ui/src/lib/row.tsx", "export const x = 1;\n");
    const base = commitAll();

    write("packages/sdk/src/format.ts", "export const format = 2;\n");
    write("packages/sdk/src/format.test.ts", 'import "./index.ts";\n');
    write(
      "packages/ui/src/screen.tsx",
      'import { x } from "#/lib";\nexport const y = x;\n',
    );
    write("packages/ui/src/lib/row.tsx", "export const x = 2;\n");
    write("packages/ui/src/lib/row.stories.tsx", "export default {};\n");
    write("packages/ui/README.md", "ui\n");
    const head = commitAll();

    await expect(
      readReadingOrder({ checkout: repo.path, head, base }),
    ).resolves.toEqual({
      groups: [
        {
          name: "packages/ui",
          files: [
            {
              path: "packages/ui/src/screen.tsx",
              entry: true,
              root: true,
              attached: [],
            },
            {
              path: "packages/ui/src/lib/row.tsx",
              entry: false,
              root: false,
              attached: ["packages/ui/src/lib/row.stories.tsx"],
            },
            {
              path: "packages/ui/README.md",
              entry: false,
              root: false,
              attached: [],
            },
          ],
        },
        {
          name: "packages/sdk",
          files: [
            {
              path: "packages/sdk/src/format.ts",
              entry: false,
              root: true,
              attached: ["packages/sdk/src/format.test.ts"],
            },
          ],
        },
      ],
    });
  });
});
