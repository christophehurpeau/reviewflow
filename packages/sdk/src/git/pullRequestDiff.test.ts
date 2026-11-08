import { execFileSync } from "node:child_process";
import { mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { diffPaths } from "../diff/diffPaths.ts";
import type { DiffStep } from "../diff/types.ts";
import type { GitHubTransport } from "../github/transport.ts";
import { readFileAtSha, readPullRequestDiff } from "./pullRequestDiff.ts";
import type { BareRemoteFixture, GitRepoFixture } from "./test/gitRepo.ts";
import { createBareRemote, createGitRepo } from "./test/gitRepo.ts";

const githubPatch = [
  "diff --git a/src/app.ts b/src/app.ts",
  "--- a/src/app.ts",
  "+++ b/src/app.ts",
  "@@ -1 +1 @@",
  "-old",
  "+new",
  "",
].join("\n");

const text = vi.fn<GitHubTransport["text"]>();
const transport = {
  text,
  graphql: vi.fn(),
  rest: vi.fn(),
} as unknown as GitHubTransport;

const ref = { ownerRepo: "acme/app", number: 12 };

describe("readPullRequestDiff", () => {
  let remote: BareRemoteFixture;
  let repo: GitRepoFixture;
  let elsewhere: string;

  /** A plain clone of the remote, standing for a colleague's machine. */
  const inElsewhere = (args: string[]): string =>
    execFileSync("git", args, { cwd: elsewhere, encoding: "utf8" });

  beforeEach(() => {
    remote = createBareRemote();
    // what GitHub allows: a pull request's head is fetched by sha
    execFileSync("git", [
      "--git-dir",
      remote.path,
      "config",
      "uploadpack.allowReachableSHA1InWant",
      "true",
    ]);
    repo = createGitRepo({ remote: remote.path });
    repo.git(["push", "--quiet", "origin", "main"]);
    elsewhere = realpathSync(
      mkdtempSync(join(tmpdir(), "reviewflow-elsewhere-")),
    );
    execFileSync("git", ["clone", "--quiet", remote.path, elsewhere]);
    inElsewhere(["config", "user.name", "a colleague"]);
    inElsewhere(["config", "user.email", "colleague@reviewflow.invalid"]);
    inElsewhere(["config", "commit.gpgsign", "false"]);
    text.mockReset();
    text.mockResolvedValue(githubPatch);
  });

  afterEach(() => {
    repo.remove();
    remote.remove();
    rmSync(elsewhere, { recursive: true, force: true });
  });

  const commitInElsewhere = (file: string): string => {
    writeFileSync(join(elsewhere, file), `${file}\n`);
    inElsewhere(["add", file]);
    inElsewhere(["commit", "--quiet", "-m", `feat: ${file}`]);
    return inElsewhere(["rev-parse", "HEAD"]).trim();
  };

  /** A colleague's branch, pushed: the checkout has never seen it. */
  const pushColleagueBranch = (): { head: string; base: string } => {
    inElsewhere(["checkout", "--quiet", "-b", "feat/thing"]);
    const head = commitInElsewhere("feature.txt");
    inElsewhere(["push", "--quiet", "origin", "feat/thing"]);
    // main moves on after the branch left it: not the pull request's change
    inElsewhere(["checkout", "--quiet", "main"]);
    const base = commitInElsewhere("later.txt");
    inElsewhere(["push", "--quiet", "origin", "main"]);
    return { head, base };
  };

  it("reads a colleague's pull request from local git, fetching its commits by sha", async () => {
    const shas = pushColleagueBranch();
    const steps: DiffStep[] = [];

    const diff = await readPullRequestDiff({
      checkout: repo.path,
      transport,
      ref,
      ...shas,
      onStep: (step) => steps.push(step),
    });

    expect(diff.source).toBe("git");
    expect(diff.fallbackReason).toBeNull();
    expect(diff.sides?.new).toBe(shas.head);
    expect(diffPaths(diff.patch)).toEqual(["feature.txt"]);
    expect(steps).toEqual(["fetching", "diffing"]);
    expect(text).not.toHaveBeenCalled();
    // objects only: no branch of the checkout names the fetched head
    expect(repo.git(["branch", "--all", "--contains", shas.head])).toBe("");
    expect(repo.git(["status", "--porcelain"])).toBe("");
  });

  it("does not fetch, nor report it, when the commits are already there", async () => {
    const head = repo.git(["rev-parse", "HEAD"]).trim();
    const steps: DiffStep[] = [];

    const diff = await readPullRequestDiff({
      checkout: repo.path,
      transport,
      ref,
      head,
      base: head,
      onStep: (step) => steps.push(step),
    });

    expect(diff.source).toBe("git");
    expect(steps).toEqual(["diffing"]);
  });

  it("groups by the manifests at the head, not at what the checkout has out", async () => {
    inElsewhere(["checkout", "--quiet", "-b", "feat/pkg"]);
    const base = inElsewhere(["rev-parse", "HEAD"]).trim();
    execFileSync("mkdir", ["-p", join(elsewhere, "apps/resident")]);
    writeFileSync(join(elsewhere, "apps/resident/package.json"), "{}\n");
    inElsewhere(["add", "-A"]);
    inElsewhere(["commit", "--quiet", "-m", "feat: package"]);
    const head = commitInElsewhere("apps/resident/index.ts");
    inElsewhere(["push", "--quiet", "origin", "feat/pkg"]);

    const diff = await readPullRequestDiff({
      checkout: repo.path,
      transport,
      ref,
      head,
      base,
    });

    expect(diff.groups).toEqual([
      {
        name: "apps/resident",
        paths: ["apps/resident/index.ts", "apps/resident/package.json"],
      },
    ]);
  });

  it("asks GitHub, saying why, when there is no checkout", async () => {
    const shas = pushColleagueBranch();

    const diff = await readPullRequestDiff({
      checkout: null,
      transport,
      ref,
      ...shas,
    });

    expect(diff).toMatchObject({
      source: "github",
      fallbackReason: "no checkout",
      sides: null,
      groups: [{ name: "src", paths: ["src/app.ts"] }],
    });
    expect(text).toHaveBeenCalledWith({
      path: `repos/acme/app/compare/${shas.base}...${shas.head}`,
      accept: "application/vnd.github.diff",
    });
  });

  /** The compare endpoint has no whitespace option: the answer says it was not applied. */
  it("answers show from GitHub when whitespace was asked hidden", async () => {
    const shas = pushColleagueBranch();

    const diff = await readPullRequestDiff({
      checkout: null,
      transport,
      ref,
      ...shas,
      whitespace: "hide",
    });

    expect(diff).toMatchObject({ source: "github", whitespace: "show" });
  });

  it("reads one commit of a pull request as its parent against it", async () => {
    inElsewhere(["checkout", "--quiet", "-b", "feat/two"]);
    const first = commitInElsewhere("one.txt");
    const second = commitInElsewhere("two.txt");
    inElsewhere(["push", "--quiet", "origin", "feat/two"]);

    const range = await readPullRequestDiff({
      checkout: repo.path,
      transport,
      ref,
      head: second,
      base: first,
    });
    const whole = await readPullRequestDiff({
      checkout: repo.path,
      transport,
      ref,
      head: second,
      base: inElsewhere(["rev-parse", `${first}^`]).trim(),
    });

    expect(range.source).toBe("git");
    expect(diffPaths(range.patch)).toEqual(["two.txt"]);
    expect(diffPaths(whole.patch)).toEqual(["one.txt", "two.txt"]);
  });

  it("falls back to GitHub with git's reason when the commits cannot be fetched", async () => {
    const missing = "0123456789abcdef0123456789abcdef01234567";

    const diff = await readPullRequestDiff({
      checkout: repo.path,
      transport,
      ref,
      head: missing,
      base: missing,
    });

    expect(diff.source).toBe("github");
    expect(diff.fallbackReason).toMatch(/git fetch/);
  });

  it("asks GitHub nothing once the reader went away", async () => {
    const missing = "0123456789abcdef0123456789abcdef01234567";
    const controller = new AbortController();
    controller.abort();
    text.mockClear();

    await expect(
      readPullRequestDiff({
        checkout: repo.path,
        transport,
        ref,
        head: missing,
        base: missing,
        signal: controller.signal,
      }),
    ).rejects.toThrow();
    expect(text).not.toHaveBeenCalled();
  });

  it("reads a file at each side of the diff, after the diff fetched its commits", async () => {
    writeFileSync(join(elsewhere, "README.md"), "first\n");
    inElsewhere(["add", "README.md"]);
    inElsewhere(["commit", "--quiet", "-m", "docs: readme"]);
    inElsewhere(["push", "--quiet", "origin", "main"]);
    const base = inElsewhere(["rev-parse", "HEAD"]).trim();
    inElsewhere(["checkout", "--quiet", "-b", "feat/edit"]);
    writeFileSync(join(elsewhere, "README.md"), "edited\n");
    inElsewhere(["commit", "--quiet", "-am", "docs: edit"]);
    const head = inElsewhere(["rev-parse", "HEAD"]).trim();
    inElsewhere(["push", "--quiet", "origin", "feat/edit"]);

    const diff = await readPullRequestDiff({
      checkout: repo.path,
      transport,
      ref,
      head,
      base,
    });

    expect(diff.sides).toEqual({ old: base, new: head });
    await expect(readFileAtSha(repo.path, base, "README.md")).resolves.toBe(
      "first\n",
    );
    await expect(readFileAtSha(repo.path, head, "README.md")).resolves.toBe(
      "edited\n",
    );
  });

  it("reads no file by anything but a sha, nor without a path", async () => {
    await expect(readFileAtSha(repo.path, "main", "README.md")).rejects.toThrow(
      "sha must be a commit sha",
    );
    await expect(
      readFileAtSha(repo.path, "0123456789abcdef0123456789abcdef01234567", ""),
    ).rejects.toThrow("path is required");
  });

  it("refuses anything but two shas", async () => {
    await expect(
      readPullRequestDiff({
        checkout: repo.path,
        transport,
        ref,
        head: "main",
        base: "HEAD~1",
      }),
    ).rejects.toThrow("head and base must be commit shas");
  });
});
