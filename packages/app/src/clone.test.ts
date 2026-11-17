import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { planClone } from "./clone.ts";

let root: string;
let dev: string;
let work: string;

beforeAll(() => {
  root = mkdtempSync(join(tmpdir(), "reviewflow-app-clone-"));
  dev = join(root, "dev");
  work = join(root, "work");
  mkdirSync(join(dev, "taken"), { recursive: true });
  mkdirSync(work);
});

afterAll(() => {
  rmSync(root, { recursive: true, force: true });
});

describe("planClone", () => {
  test("clones directly under the chosen configured folder", () => {
    expect(
      planClone({
        repoPaths: [dev, work],
        ownerRepo: "acme/widgets",
        folder: work,
      }),
    ).toEqual({ ownerRepo: "acme/widgets", target: join(work, "widgets") });
  });

  test("matches the folder however its trailing slash is written", () => {
    expect(
      planClone({
        repoPaths: [`${dev}/`],
        ownerRepo: "acme/.github",
        folder: dev,
      }),
    ).toEqual({ ownerRepo: "acme/.github", target: join(dev, ".github") });
  });

  test("refuses a folder that is not one of repoPaths", () => {
    expect(
      planClone({ repoPaths: [dev], ownerRepo: "acme/widgets", folder: work }),
    ).toEqual({
      refused: `folder must be one of the repositories folders: ${dev}`,
    });
    expect(
      planClone({ repoPaths: [], ownerRepo: "acme/widgets", folder: dev }),
    ).toEqual({
      refused:
        "folder must be one of the repositories folders: no repositories folder",
    });
  });

  test.each(["acme", "acme/../etc", "acme/..", "acme/.", "../acme/w", 42])(
    "refuses %s as a repository name",
    (ownerRepo) => {
      expect(planClone({ repoPaths: [dev], ownerRepo, folder: dev })).toEqual({
        refused: "ownerRepo must be owner/repo",
      });
    },
  );

  test("refuses a target that already exists, and a folder that does not", () => {
    expect(
      planClone({ repoPaths: [dev], ownerRepo: "acme/taken", folder: dev }),
    ).toEqual({
      refused: `${join(dev, "taken")} already exists: move it, or clone into another folder`,
    });
    const missing = join(root, "unmounted");
    expect(
      planClone({
        repoPaths: [missing],
        ownerRepo: "acme/widgets",
        folder: missing,
      }),
    ).toEqual({ refused: `${missing} does not exist or is not a directory` });
  });
});
