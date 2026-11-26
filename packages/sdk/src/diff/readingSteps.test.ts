import { describe, expect, it } from "vitest";
import {
  readingOrderOfStep,
  readingStepPaths,
  readingStepsOf,
} from "./readingSteps.ts";
import type { DiffReadingFile } from "./types.ts";

const file = (
  path: string,
  { root = false, entry = false, attached = [] as string[] } = {},
): DiffReadingFile => ({ path, root, entry, attached });

const entry = (path: string, attached: string[] = []): DiffReadingFile =>
  file(path, { root: true, entry: true, attached });

const loneRoot = (path: string): DiffReadingFile => file(path, { root: true });

describe("readingStepsOf", () => {
  it("starts a step at each entry point, with the files it reaches", () => {
    const steps = readingStepsOf({
      groups: [
        {
          name: "packages/a",
          files: [
            entry("packages/a/src/index.ts", ["packages/a/src/index.test.ts"]),
            file("packages/a/src/util.ts"),
            entry("packages/a/src/cli.ts"),
            file("packages/a/src/args.ts"),
          ],
        },
      ],
    });
    expect(steps.map(({ key }) => key)).toEqual([
      "entry:packages/a/src/index.ts",
      "entry:packages/a/src/cli.ts",
    ]);
    expect(readingStepPaths(steps[0]!)).toEqual([
      "packages/a/src/index.ts",
      "packages/a/src/index.test.ts",
      "packages/a/src/util.ts",
    ]);
    expect(readingStepPaths(steps[1]!)).toEqual([
      "packages/a/src/cli.ts",
      "packages/a/src/args.ts",
    ]);
  });

  it("puts what no entry point reaches in one last step of its package", () => {
    const steps = readingStepsOf({
      groups: [
        {
          name: "packages/a",
          files: [
            entry("packages/a/src/index.ts"),
            file("packages/a/src/util.ts"),
            loneRoot("packages/a/src/alone.ts"),
            loneRoot("packages/a/src/other.ts"),
            file("packages/a/src/cycle.ts"),
            file("packages/a/package.json"),
            file("packages/a/src/orphan.test.ts"),
          ],
        },
        { name: "", files: [file("README.md")] },
      ],
    });
    expect(steps.map(({ key, entry: start }) => ({ key, start }))).toEqual([
      {
        key: "entry:packages/a/src/index.ts",
        start: "packages/a/src/index.ts",
      },
      { key: "others:packages/a", start: null },
      { key: "others:", start: null },
    ]);
    expect(readingStepPaths(steps[1]!)).toEqual([
      "packages/a/src/alone.ts",
      "packages/a/src/other.ts",
      "packages/a/src/cycle.ts",
      "packages/a/package.json",
      "packages/a/src/orphan.test.ts",
    ]);
  });

  it("makes a package without entry point a single step", () => {
    const steps = readingStepsOf({
      groups: [
        { name: "", files: [loneRoot("src/a.ts"), loneRoot("src/b.ts")] },
      ],
    });
    expect(steps).toHaveLength(1);
    expect(steps[0]!.entry).toBeNull();
    expect(readingStepPaths(steps[0]!)).toEqual(["src/a.ts", "src/b.ts"]);
  });
});

describe("readingOrderOfStep", () => {
  it("keeps the step's files in their package", () => {
    const [step] = readingStepsOf({
      groups: [{ name: "packages/a", files: [entry("packages/a/x.ts")] }],
    });
    expect(readingOrderOfStep(step!)).toEqual({
      groups: [{ name: "packages/a", files: [entry("packages/a/x.ts")] }],
    });
  });
});
