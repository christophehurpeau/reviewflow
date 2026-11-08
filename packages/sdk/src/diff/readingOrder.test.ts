import { describe, expect, it } from "vitest";
import {
  isAttachablePath,
  orderForReading,
  orderPackages,
  resolveRelative,
  resolveSubpathImport,
} from "./readingOrder.ts";

describe("isAttachablePath", () => {
  it("recognizes tests, specs, stories and __tests__ files", () => {
    expect(isAttachablePath("src/a.test.ts")).toBe(true);
    expect(isAttachablePath("src/a.spec.tsx")).toBe(true);
    expect(isAttachablePath("src/a.stories.tsx")).toBe(true);
    expect(isAttachablePath("src/__tests__/a.ts")).toBe(true);
    expect(isAttachablePath("src/tests/setup.ts")).toBe(true);
    expect(isAttachablePath("src/git/test/gitRepo.ts")).toBe(true);
    expect(isAttachablePath("src/__mocks__/fs.ts")).toBe(true);
    expect(isAttachablePath("src/testing.ts")).toBe(false);
    expect(isAttachablePath("src/a.ts")).toBe(false);
    expect(isAttachablePath("src/a.test.js")).toBe(false);
    expect(isAttachablePath("src/latest.ts")).toBe(false);
  });
});

describe("resolveRelative", () => {
  const files = new Set([
    "src/a.ts",
    "src/b.tsx",
    "src/dir/index.ts",
    "src/c.mts",
    "src/octokit.d.ts",
    "readme.md",
  ]);
  const exists = (path: string): boolean => files.has(path);

  it("resolves a declaration file, as TypeScript does", () => {
    expect(resolveRelative("src/x.ts", "./octokit", exists)).toBe(
      "src/octokit.d.ts",
    );
    expect(resolveRelative("src/x.ts", "./octokit.js", exists)).toBe(
      "src/octokit.d.ts",
    );
  });

  it("resolves as written, a .js for its .ts, a missing extension and an index", () => {
    expect(resolveRelative("src/x.ts", "./a.ts", exists)).toBe("src/a.ts");
    expect(resolveRelative("src/x.ts", "./a.js", exists)).toBe("src/a.ts");
    expect(resolveRelative("src/x.ts", "./b.jsx", exists)).toBe("src/b.tsx");
    expect(resolveRelative("src/x.ts", "./c.mjs", exists)).toBe("src/c.mts");
    expect(resolveRelative("src/x.ts", "./b", exists)).toBe("src/b.tsx");
    expect(resolveRelative("src/x.ts", "./dir", exists)).toBe(
      "src/dir/index.ts",
    );
    expect(resolveRelative("src/dir/y.ts", "../a", exists)).toBe("src/a.ts");
  });

  it("resolves nothing for a bare specifier, a missing file, a non-TypeScript file or a path above the root", () => {
    expect(resolveRelative("src/x.ts", "react", exists)).toBeNull();
    expect(resolveRelative("src/x.ts", "./missing", exists)).toBeNull();
    expect(resolveRelative("src/x.ts", "../readme.md", exists)).toBeNull();
    expect(resolveRelative("x.ts", "../../a", exists)).toBeNull();
  });
});

describe("resolveSubpathImport", () => {
  const files = new Set([
    "packages/app/src/services/api.ts",
    "packages/app/.storybook/Story.tsx",
    "packages/app/src/env.ts",
  ]);
  const exists = (path: string): boolean => files.has(path);
  const app = {
    directory: "packages/app",
    imports: {
      "#/*": "./src/*",
      "#storybook/*": "./.storybook/*",
      "#env": { types: "./src/env.ts", default: "./build/env.js" },
      "#external": "lodash",
    },
  };

  it("resolves through the package's own imports, the most specific pattern first", () => {
    expect(resolveSubpathImport("#/services/api.ts", app, exists)).toBe(
      "packages/app/src/services/api.ts",
    );
    expect(resolveSubpathImport("#storybook/Story.tsx", app, exists)).toBe(
      "packages/app/.storybook/Story.tsx",
    );
    expect(resolveSubpathImport("#env", app, exists)).toBe(
      "packages/app/src/env.ts",
    );
  });

  it("resolves nothing for a relative specifier, a package target, an unmatched key or no imports", () => {
    expect(resolveSubpathImport("./api.ts", app, exists)).toBeNull();
    expect(resolveSubpathImport("#external", app, exists)).toBeNull();
    expect(resolveSubpathImport("#nope", app, exists)).toBeNull();
    expect(
      resolveSubpathImport(
        "#/services/api.ts",
        { directory: "packages/app", imports: undefined },
        exists,
      ),
    ).toBeNull();
  });
});

describe("orderPackages", () => {
  it("puts the root first, then a package before what it depends on, even through an untouched package", () => {
    const dependsOn = new Map([
      ["packages/app", new Set(["packages/ui"])],
      ["packages/ui", new Set(["packages/core"])],
      ["packages/core", new Set(["packages/sdk"])],
    ]);
    expect(
      orderPackages(
        ["packages/sdk", "", ".claude", "packages/app", "packages/ui"],
        dependsOn,
      ),
    ).toEqual(["", ".claude", "packages/app", "packages/ui", "packages/sdk"]);
  });

  it("breaks a cycle alphabetically", () => {
    const dependsOn = new Map([
      ["b", new Set(["a"])],
      ["a", new Set(["b"])],
    ]);
    expect(orderPackages(["b", "a"], dependsOn)).toEqual(["a", "b"]);
  });
});

describe("orderForReading", () => {
  const none = new Map<string, Set<string>>();

  it("reads from the entry point down, depth first, in import order", () => {
    expect(
      orderForReading({
        groups: [
          {
            name: "pkg",
            paths: [
              "pkg/src/a.ts",
              "pkg/src/b.ts",
              "pkg/src/c.ts",
              "pkg/src/route.ts",
            ],
          },
        ],
        imports: new Map([
          ["pkg/src/route.ts", ["pkg/src/b.ts", "pkg/src/a.ts"]],
          ["pkg/src/b.ts", ["pkg/src/c.ts"]],
          ["pkg/src/a.ts", []],
          ["pkg/src/c.ts", []],
        ]),
        dependsOn: none,
      }),
    ).toEqual([
      {
        name: "pkg",
        files: [
          { path: "pkg/src/route.ts", entry: true, root: true, attached: [] },
          { path: "pkg/src/b.ts", entry: false, root: false, attached: [] },
          { path: "pkg/src/c.ts", entry: false, root: false, attached: [] },
          { path: "pkg/src/a.ts", entry: false, root: false, attached: [] },
        ],
      },
    ]);
  });

  it("follows imports through unchanged files, and puts the entry reaching most files first", () => {
    const [group] = orderForReading({
      groups: [
        {
          name: "",
          paths: ["lone.ts", "screen.tsx", "utils/format.ts"],
        },
      ],
      imports: new Map([
        ["screen.tsx", ["utils/index.ts"]],
        ["utils/index.ts", ["utils/format.ts"]],
        ["utils/format.ts", []],
        ["lone.ts", []],
      ]),
      dependsOn: none,
    });
    expect(
      group?.files.map(({ path, entry, root }) => ({ path, entry, root })),
    ).toEqual([
      { path: "screen.tsx", entry: true, root: true },
      { path: "utils/format.ts", entry: false, root: false },
      { path: "lone.ts", entry: false, root: true },
    ]);
  });

  it("attaches tests and stories to their subject, else to what they import, and keeps the others after the rest", () => {
    const [group] = orderForReading({
      groups: [
        {
          name: "",
          paths: [
            "README.md",
            "src/__tests__/b.ts",
            "src/a.stories.tsx",
            "src/a.test.ts",
            "src/a.tsx",
            "src/b.ts",
            "src/helpers.test.ts",
            "src/orphan.test.ts",
            "src/tests/setup.ts",
          ],
        },
      ],
      imports: new Map([
        ["src/a.tsx", ["src/b.ts"]],
        ["src/a.test.ts", ["src/tests/setup.ts", "src/b.ts"]],
        ["src/helpers.test.ts", ["src/unchanged.ts"]],
        ["src/unchanged.ts", ["src/b.ts"]],
        ["src/orphan.test.ts", ["src/elsewhere.ts"]],
      ]),
      dependsOn: none,
    });
    expect(group?.files).toEqual([
      {
        path: "src/a.tsx",
        entry: true,
        root: true,
        attached: ["src/a.stories.tsx", "src/a.test.ts"],
      },
      {
        path: "src/b.ts",
        entry: false,
        root: false,
        attached: ["src/__tests__/b.ts", "src/helpers.test.ts"],
      },
      { path: "README.md", entry: false, root: false, attached: [] },
      { path: "src/orphan.test.ts", entry: false, root: false, attached: [] },
      { path: "src/tests/setup.ts", entry: false, root: false, attached: [] },
    ]);
  });

  it("attaches a test with a qualified name to its subject, else to what it imports beside it rather than a shared helper", () => {
    const [group] = orderForReading({
      groups: [
        {
          name: "",
          paths: [
            "src/database/failover.ts",
            "src/database/failover.unit.test.ts",
            "src/database/primary.unit.test.ts",
            "src/database/watch-primary.ts",
            "src/shared/logger.ts",
            "src/shared/logger.with-mongo.test.ts",
          ],
        },
      ],
      imports: new Map([
        ["src/database/failover.ts", ["src/shared/logger.ts"]],
        [
          "src/database/failover.unit.test.ts",
          ["src/shared/logger.ts", "src/database/failover.ts"],
        ],
        [
          "src/database/primary.unit.test.ts",
          ["src/shared/logger.ts", "src/database/watch-primary.ts"],
        ],
      ]),
      dependsOn: none,
    });
    expect(
      group?.files.map(({ path, attached }) => ({ path, attached })),
    ).toEqual([
      {
        path: "src/database/failover.ts",
        attached: ["src/database/failover.unit.test.ts"],
      },
      {
        path: "src/shared/logger.ts",
        attached: ["src/shared/logger.with-mongo.test.ts"],
      },
      {
        path: "src/database/watch-primary.ts",
        attached: ["src/database/primary.unit.test.ts"],
      },
    ]);
  });

  it("reads a cycle no entry point reaches", () => {
    const [group] = orderForReading({
      groups: [{ name: "", paths: ["b.ts", "a.ts"] }],
      imports: new Map([
        ["a.ts", ["b.ts"]],
        ["b.ts", ["a.ts"]],
      ]),
      dependsOn: none,
    });
    expect(group?.files.map(({ path }) => path)).toEqual(["a.ts", "b.ts"]);
  });

  it("does not go through a changed file of another package", () => {
    const [, group] = orderForReading({
      groups: [
        { name: "a", paths: ["a/x.ts"] },
        { name: "b", paths: ["b/entry.ts", "b/leaf.ts"] },
      ],
      imports: new Map([
        ["b/entry.ts", ["a/x.ts"]],
        ["a/x.ts", ["b/leaf.ts"]],
      ]),
      dependsOn: none,
    });
    expect(
      group?.files.map(({ path, entry, root }) => ({ path, entry, root })),
    ).toEqual([
      { path: "b/entry.ts", entry: false, root: true },
      { path: "b/leaf.ts", entry: false, root: true },
    ]);
  });
});
