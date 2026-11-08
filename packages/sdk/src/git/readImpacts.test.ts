import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { DiffImpactsResponse } from "../diff/impacts.ts";
import {
  createBindingsCache,
  parseTouchedLines,
  readImpacts,
} from "./readImpacts.ts";
import type { BindingsCache } from "./readImpacts.ts";
import type { GitRepoFixture } from "./test/gitRepo.ts";
import { createGitRepo } from "./test/gitRepo.ts";

describe("parseTouchedLines", () => {
  it("reads the new side of each hunk, and a deletion as the line it sits before", () => {
    const diff = [
      "diff --git a/a.ts b/a.ts",
      "--- a/a.ts",
      "+++ b/a.ts",
      "@@ -3 +3,2 @@ const x",
      "-old",
      "+new",
      "+new2",
      "@@ -10,2 +11,0 @@",
      "-gone",
      "-gone2",
      "@@ -20,0 +20 @@",
      "+added",
      "diff --git a/b.ts b/b.ts",
      "deleted file mode 100644",
      "--- a/b.ts",
      "+++ /dev/null",
      "@@ -1,3 +0,0 @@",
      "-x",
    ].join("\n");
    expect([...parseTouchedLines(diff)]).toEqual([
      [
        "a.ts",
        [
          { start: 3, end: 4 },
          { start: 12, end: 12 },
          { start: 20, end: 20 },
        ],
      ],
    ]);
  });
});

describe("createBindingsCache", () => {
  it("evicts the entry least recently used past its bound", () => {
    const cache = createBindingsCache(2);
    const summary = { exports: [], imports: [], reExports: [] };
    cache.set("a", summary);
    cache.set("b", summary);
    cache.get("a");
    cache.set("c", summary);
    expect(cache.get("a")).toBe(summary);
    expect(cache.get("b")).toBeUndefined();
    expect(cache.get("c")).toBe(summary);
  });
});

describe("readImpacts", () => {
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

  const lines = (...rows: string[]): string => `${rows.join("\n")}\n`;

  const countingCache = (): { cache: BindingsCache; sets: () => number } => {
    const inner = createBindingsCache();
    let sets = 0;
    return {
      cache: {
        get: inner.get,
        set: (oid, summary) => {
          sets++;
          inner.set(oid, summary);
        },
      },
      sets: () => sets,
    };
  };

  const writeBase = (): void => {
    write("package.json", '{ "name": "root" }');
    write(
      "packages/sdk/package.json",
      JSON.stringify({
        name: "@acme/sdk",
        exports: {
          ".": { types: "./src/index.ts" },
          "./git": { types: "./src/git.ts" },
        },
      }),
    );
    write(
      "packages/sdk/src/index.ts",
      lines(
        'export { format, removedLater } from "./format.ts";',
        'export { render as draw } from "./render.ts";',
        'import { helperUsed } from "./util.ts";',
        "export { helperUsed };",
        'export * from "./more.ts";',
      ),
    );
    write(
      "packages/sdk/src/format.ts",
      lines(
        'const prefix = ">";',
        "export const format = (text: string) => prefix + text;",
        "export const other = 1;",
        "export const removedLater = 1;",
      ),
    );
    write("packages/sdk/src/render.ts", "export const render = () => 1;\n");
    write("packages/sdk/src/util.ts", "export const helperUsed = 1;\n");
    write("packages/sdk/src/more.ts", "export const viaStar = 1;\n");
    write(
      "packages/sdk/src/git.ts",
      lines("export const readThing = 1;", "export const readOther = 2;"),
    );
    write("packages/sdk/README.md", "# sdk\n");
    write(
      "packages/ui/package.json",
      '{ "name": "@acme/ui", "dependencies": { "@acme/sdk": "workspace:*", "react": "*" } }',
    );
    write(
      "packages/ui/src/screen.tsx",
      lines(
        'import { format, draw, helperUsed, viaStar } from "@acme/sdk";',
        'import React from "react";',
        'import "./a.css";',
        "export const screen = [format, draw, helperUsed, viaStar, React];",
      ),
    );
    write("packages/ui/src/a.css", "body {}\n");
    write(
      "packages/ui/src/screen.test.tsx",
      'import { format } from "@acme/sdk";\nformat("x");\n',
    );
    write(
      "packages/ui/src/ns.ts",
      'import * as git from "@acme/sdk/git";\nexport const all = git;\n',
    );
    write(
      "packages/ui/src/legacy.ts",
      'import { removedLater } from "@acme/sdk";\nexport const legacy = removedLater;\n',
    );
    write(
      "packages/ui/src/inDiff.ts",
      'import { format } from "@acme/sdk";\nexport const inDiff = format;\n',
    );
    write(
      "packages/ui/src/untouched.ts",
      'import { other } from "@acme/sdk/git";\nexport const untouched = other;\n',
    );
  };

  const writeChange = (): void => {
    write(
      "packages/sdk/src/format.ts",
      lines(
        'const prefix = "> ";',
        "export const format = (text: string) => prefix + text;",
        "export const other = 1;",
      ),
    );
    write("packages/sdk/src/render.ts", "export const render = () => 2;\n");
    write("packages/sdk/src/util.ts", "export const helperUsed = 2;\n");
    write("packages/sdk/src/more.ts", "export const viaStar = 2;\n");
    write(
      "packages/sdk/src/git.ts",
      lines("export const readThing = 3;", "export const readOther = 4;"),
    );
    write("packages/sdk/README.md", "# sdk, changed\n");
    write(
      "packages/ui/src/inDiff.ts",
      'import { format } from "@acme/sdk";\nexport const inDiff = [format];\n',
    );
    write(
      "packages/ui/src/alias.ts",
      'import { x } from "@/lib/x";\nexport const alias = x;\n',
    );
  };

  const impactsOf = (
    answer: DiffImpactsResponse,
  ): Record<string, Record<string, string[]>> => {
    if (answer.tooLarge) throw new Error("too large");
    return Object.fromEntries(
      answer.files.map(({ path, exports }) => [
        path,
        Object.fromEntries(
          exports.map(({ name, removed, importers }) => [
            removed ? `${name} (removed)` : name,
            importers.map(({ path: importer, test }) =>
              test ? `${importer} (test)` : importer,
            ),
          ]),
        ),
      ]),
    );
  };

  it("lists, per touched export, the importers outside the diff across packages, through barrels", async () => {
    writeBase();
    const base = commitAll();
    writeChange();
    const head = commitAll();

    const answer = await readImpacts({
      checkout: repo.path,
      head,
      base,
      cache: createBindingsCache(),
    });

    expect(impactsOf(answer)).toEqual({
      // `format`: a helper it uses is touched; inDiff.ts is in the diff
      "packages/sdk/src/format.ts": {
        format: [
          "packages/ui/src/screen.test.tsx (test)",
          "packages/ui/src/screen.tsx",
        ],
        "removedLater (removed)": ["packages/ui/src/legacy.ts"],
      },
      // reached through `export { render as draw }`
      "packages/sdk/src/render.ts": { render: ["packages/ui/src/screen.tsx"] },
      // the barrel form `import { helperUsed } ...; export { helperUsed }`
      "packages/sdk/src/util.ts": {
        helperUsed: ["packages/ui/src/screen.tsx"],
      },
      // `export *`
      "packages/sdk/src/more.ts": { viaStar: ["packages/ui/src/screen.tsx"] },
      // `import * as git`: every touched export counts as used
      "packages/sdk/src/git.ts": {
        readThing: ["packages/ui/src/ns.ts"],
        readOther: ["packages/ui/src/ns.ts"],
      },
    });
    expect(answer).toMatchObject({
      tooLarge: false,
      notAnalyzed: ["packages/sdk/README.md"],
      unresolvedIn: ["packages/ui"],
    });
  });

  it("reports nothing unresolved for a stylesheet, a package of node_modules or a resolved subpath", async () => {
    writeBase();
    const base = commitAll();
    write("packages/sdk/src/render.ts", "export const render = () => 2;\n");
    const head = commitAll();

    const answer = await readImpacts({
      checkout: repo.path,
      head,
      base,
      cache: createBindingsCache(),
    });

    expect(answer).toMatchObject({ tooLarge: false, unresolvedIn: [] });
  });

  it("reports a package entry pointing at a build output as unresolved, not as unused", async () => {
    writeBase();
    write(
      "packages/sdk/package.json",
      '{ "name": "@acme/sdk", "exports": { ".": "./build/index.js" } }',
    );
    const base = commitAll();
    write("packages/sdk/src/render.ts", "export const render = () => 2;\n");
    const head = commitAll();

    const answer = await readImpacts({
      checkout: repo.path,
      head,
      base,
      cache: createBindingsCache(),
    });

    expect(impactsOf(answer)).toEqual({});
    expect(answer).toMatchObject({ unresolvedIn: ["packages/ui"] });
  });

  const changeRender = (): string => {
    write("packages/sdk/src/render.ts", "export const render = () => 2;\n");
    return commitAll();
  };

  const unresolvedAfter = async (
    base: string,
    head: string,
  ): Promise<string[]> => {
    const answer = await readImpacts({
      checkout: repo.path,
      head,
      base,
      cache: createBindingsCache(),
    });
    if (answer.tooLarge) throw new Error("too large");
    return answer.unresolvedIn;
  };

  it("ignores a relative or # specifier naming no file: every changed file exists", async () => {
    writeBase();
    write(
      "packages/ui/src/missing.ts",
      'import "./nowhere";\nimport "#/nowhere";\n',
    );
    const base = commitAll();
    expect(await unresolvedAfter(base, changeRender())).toEqual([]);
  });

  it("counts a path alias only in a package holding a changed TypeScript file", async () => {
    writeBase();
    write("packages/ui/src/alias.ts", 'import { x } from "@/lib/x";\n');
    const base = commitAll();
    expect(await unresolvedAfter(base, changeRender())).toEqual([]);

    write("packages/ui/src/screen.tsx", "export const screen = 2;\n");
    expect(await unresolvedAfter(base, commitAll())).toEqual(["packages/ui"]);
  });

  it("counts a bare specifier as an alias unless a built-in or a declared dependency", async () => {
    writeBase();
    write(
      "package.json",
      '{ "name": "root", "devDependencies": { "vitest": "*" } }',
    );
    write(
      "packages/ui/package.json",
      JSON.stringify({
        name: "@acme/ui",
        dependencies: { "@acme/sdk": "workspace:*", react: "*" },
        peerDependencies: { "react-dom": "*" },
      }),
    );
    write(
      "packages/ui/src/ext.ts",
      lines(
        'import React from "react";',
        'import { readFileSync } from "node:fs";',
        'import { join } from "path";',
        'import { readFile } from "fs/promises";',
        'import { createRoot } from "react-dom/client";',
        'import { it } from "vitest";',
        'import "./a.css";',
      ),
    );
    const base = commitAll();
    write("packages/ui/src/screen.tsx", "export const screen = 2;\n");
    expect(await unresolvedAfter(base, commitAll())).toEqual([]);

    write("packages/ui/src/alias.ts", 'import { x } from "@app/lib/x";\n');
    expect(await unresolvedAfter(base, commitAll())).toEqual(["packages/ui"]);
  });

  it("counts an unscoped path alias such as src/x", async () => {
    writeBase();
    write("packages/ui/src/alias.ts", 'import { x } from "src/lib/x";\n');
    const base = commitAll();
    write("packages/ui/src/screen.tsx", "export const screen = 2;\n");
    expect(await unresolvedAfter(base, commitAll())).toEqual(["packages/ui"]);
  });

  it("counts an unresolved workspace package only when its target package has a changed file", async () => {
    writeBase();
    write(
      "packages/sdk/package.json",
      '{ "name": "@acme/sdk", "exports": { ".": "./build/index.js" } }',
    );
    const base = commitAll();
    write("packages/ui/src/screen.tsx", "export const screen = 2;\n");
    const uiOnly = commitAll();
    expect(await unresolvedAfter(base, uiOnly)).toEqual([]);

    expect(await unresolvedAfter(base, changeRender())).toEqual([
      "packages/ui",
    ]);
  });

  const impactsAfter = async (
    base: string,
    head: string,
  ): Promise<DiffImpactsResponse> =>
    readImpacts({
      checkout: repo.path,
      head,
      base,
      cache: createBindingsCache(),
    });

  const barrelWith = (...extra: string[]): string =>
    lines(
      'export { format, removedLater } from "./format.ts";',
      'export { render as draw } from "./render.ts";',
      'import { helperUsed } from "./util.ts";',
      "export { helperUsed };",
      ...extra,
    );

  it("lists the importers of the names of a removed `export *` as users of removed exports", async () => {
    writeBase();
    const base = commitAll();
    write("packages/sdk/src/index.ts", barrelWith());
    const head = commitAll();

    expect(impactsOf(await impactsAfter(base, head))).toEqual({
      "packages/sdk/src/index.ts": {
        "viaStar (removed)": ["packages/ui/src/screen.tsx"],
      },
    });
  });

  it("lists the importers of the names of an added `export *`", async () => {
    writeBase();
    write("packages/sdk/src/index.ts", barrelWith());
    const base = commitAll();
    write(
      "packages/sdk/src/index.ts",
      barrelWith('export * from "./more.ts";'),
    );
    const head = commitAll();

    expect(impactsOf(await impactsAfter(base, head))).toEqual({
      "packages/sdk/src/index.ts": { viaStar: ["packages/ui/src/screen.tsx"] },
    });
  });

  it("expands a removed `export *` through the stars of its target", async () => {
    writeBase();
    write("packages/sdk/src/more.ts", 'export * from "./deeper.ts";\n');
    write("packages/sdk/src/deeper.ts", "export const viaStar = 1;\n");
    const base = commitAll();
    write("packages/sdk/src/index.ts", barrelWith());
    const head = commitAll();

    expect(impactsOf(await impactsAfter(base, head))).toEqual({
      "packages/sdk/src/index.ts": {
        "viaStar (removed)": ["packages/ui/src/screen.tsx"],
      },
    });
  });

  it("does not report a name as removed when the barrel still passes it on", async () => {
    writeBase();
    write("packages/sdk/src/other.ts", "export const viaStar = 1;\n");
    const base = commitAll();
    write(
      "packages/sdk/src/index.ts",
      barrelWith('export * from "./other.ts";'),
    );
    const head = commitAll();

    expect(impactsOf(await impactsAfter(base, head))).toEqual({
      "packages/sdk/src/index.ts": { viaStar: ["packages/ui/src/screen.tsx"] },
    });
  });

  it("puts a file whose removed `export *` target is unknown at the base in notAnalyzed", async () => {
    writeBase();
    write(
      "packages/sdk/src/index.ts",
      barrelWith('export * from "./gone.ts";'),
    );
    write("packages/sdk/src/gone.ts", "export const g = 1;\n");
    const base = commitAll();
    write("packages/sdk/src/index.ts", barrelWith());
    rmSync(join(repo.path, "packages/sdk/src/gone.ts"));
    const head = commitAll();

    expect(await impactsAfter(base, head)).toMatchObject({
      notAnalyzed: expect.arrayContaining(["packages/sdk/src/index.ts"]),
    });
  });

  it("follows a rename of the file without touching its exports", async () => {
    writeBase();
    const base = commitAll();
    repo.git(["mv", "packages/sdk/src/util.ts", "packages/sdk/src/util2.ts"]);
    write(
      "packages/sdk/src/index.ts",
      lines(
        'export { format, removedLater } from "./format.ts";',
        'export { render as draw } from "./render.ts";',
        'import { helperUsed } from "./util2.ts";',
        "export { helperUsed };",
        'export * from "./more.ts";',
      ),
    );
    const head = commitAll();

    const answer = await readImpacts({
      checkout: repo.path,
      head,
      base,
      cache: createBindingsCache(),
    });

    expect(impactsOf(answer)).toEqual({});
  });

  it("does not analyze a deleted file", async () => {
    writeBase();
    const base = commitAll();
    rmSync(join(repo.path, "packages/sdk/src/more.ts"));
    const head = commitAll();

    const answer = await readImpacts({
      checkout: repo.path,
      head,
      base,
      cache: createBindingsCache(),
    });

    expect(answer).toMatchObject({
      notAnalyzed: ["packages/sdk/src/more.ts"],
    });
  });

  it("parses only the blobs that differ when a second head reuses the cache", async () => {
    writeBase();
    const base = commitAll();
    writeChange();
    const first = commitAll();
    write("packages/sdk/src/render.ts", "export const render = () => 3;\n");
    const second = commitAll();
    const { cache, sets } = countingCache();

    await readImpacts({ checkout: repo.path, head: first, base, cache });
    const cold = sets();
    const answer = await readImpacts({
      checkout: repo.path,
      head: second,
      base,
      cache,
    });

    expect(cold).toBeGreaterThan(10);
    expect(sets() - cold).toBe(1);
    expect(impactsOf(answer)["packages/sdk/src/render.ts"]).toEqual({
      render: ["packages/ui/src/screen.tsx"],
    });
  });

  it("answers tooLarge past the file budget, without reading anything", async () => {
    writeBase();
    const base = commitAll();
    write("packages/sdk/src/render.ts", "export const render = () => 2;\n");
    const head = commitAll();
    const { cache, sets } = countingCache();

    expect(
      await readImpacts({
        checkout: repo.path,
        head,
        base,
        cache,
        maxFiles: 3,
      }),
    ).toEqual({ tooLarge: true, reason: "files" });
    expect(sets()).toBe(0);
  });

  it("answers tooLarge with the reason time past the read budget, keeping what was parsed", async () => {
    writeBase();
    const base = commitAll();
    write("packages/sdk/src/render.ts", "export const render = () => 2;\n");
    const head = commitAll();

    expect(
      await readImpacts({
        checkout: repo.path,
        head,
        base,
        cache: createBindingsCache(),
        maxReadMs: -1,
      }),
    ).toEqual({ tooLarge: true, reason: "time" });
  });

  it("refuses a ref that is not a sha", async () => {
    await expect(
      readImpacts({
        checkout: repo.path,
        head: "main",
        base: "main",
        cache: createBindingsCache(),
      }),
    ).rejects.toThrow("head and base must be commit shas");
  });
});
