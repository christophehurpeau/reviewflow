import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { completeWalkthrough, patchOfHunks } from "../diff/walkthrough.ts";
import type { GitRepoFixture } from "./test/gitRepo.ts";
import { createGitRepo } from "./test/gitRepo.ts";
import { readWalkthroughDiff } from "./walkthrough.ts";

const lines = (
  count: number,
  edit?: (index: number) => string | undefined,
): string =>
  `${Array.from({ length: count }, (_, index) => edit?.(index) ?? `line ${String(index)}`).join("\n")}\n`;

describe("readWalkthroughDiff", () => {
  let repo: GitRepoFixture;
  let base: string;
  let head: string;

  beforeEach(() => {
    repo = createGitRepo();
    writeFileSync(join(repo.path, "app.ts"), lines(40));
    repo.git(["add", "."]);
    repo.commit();
    base = repo.git(["rev-parse", "HEAD"]).trim();
    writeFileSync(
      join(repo.path, "app.ts"),
      lines(40, (index) => {
        if (index === 2) return "changed near the top";
        if (index === 30) return "    line 30";
        return undefined;
      }),
    );
    repo.git(["commit", "--quiet", "-am", "feat: change"]);
    head = repo.git(["rev-parse", "HEAD"]).trim();
  });

  afterEach(() => {
    repo.remove();
  });

  it("numbers the hunks of the diff with whitespace shown", async () => {
    const diff = await readWalkthroughDiff({ checkout: repo.path, head, base });
    expect(diff.mergeBase).toBe(base);
    expect(diff.annotatedPatch).toContain("### hunk app.ts#1\n@@ -1,6 +1,6 @@");
    expect(diff.annotatedPatch).toContain(
      "### hunk app.ts#2\n@@ -28,7 +28,7 @@",
    );
  });

  it("checks a draft against it, and its step finds no hunk once whitespace is hidden", async () => {
    const diff = await readWalkthroughDiff({ checkout: repo.path, head, base });
    const { walkthrough } = completeWalkthrough({
      candidate: {
        title: "Reindent",
        ticket: null,
        problem: {
          text: "Why",
          sources: [{ label: "description", url: null }],
        },
        weaknesses: [],
        chapters: [
          {
            id: "c",
            title: "Chapter",
            summary: "The reindent",
            steps: [
              {
                id: "s",
                title: "The reindent",
                explanation: "A reindented line.",
                hunks: ["app.ts#2"],
                notes: [],
                concerns: [],
              },
            ],
          },
        ],
      },
      patch: diff.patch,
      head,
      base,
      writtenAt: "2026-11-26T00:00:00.000Z",
    });
    const ranges = Object.values(walkthrough?.hunks ?? {});
    expect(patchOfHunks(diff.patch, ranges)).toContain("+    line 30");
    const hidden = repo.git(["diff", "-w", base, head]);
    expect(patchOfHunks(hidden, ranges)).toBe("");
  });
});
