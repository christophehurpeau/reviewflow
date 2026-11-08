import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, realpathSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { env } from "node:process";

export interface GitRepoFixture {
  /** the realpath, so it matches what git reports back */
  path: string;
  git: (args: string[], cwd?: string) => string;
  /** `committedAt` pins the committer date, so ordering assertions are stable */
  commit: (cwd?: string, committedAt?: string) => void;
  remove: () => void;
}

export interface CreateGitRepoOptions {
  /** null leaves the repo without an `origin` remote */
  remote?: string | null;
  /** false leaves the repo without a commit */
  initialCommit?: boolean;
  branch?: string;
}

/**
 * A throwaway repository shaped like a real one. Identity and signing
 * are set locally: a fixture commit must never depend on the operator's git
 * config or gpg agent, and an empty template keeps the sample hooks of whatever
 * git installation is on the machine out of it.
 */
export const createGitRepo = ({
  remote = "git@github.com:acme/app.git",
  initialCommit = true,
  branch = "main",
}: CreateGitRepoOptions = {}): GitRepoFixture => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), "reviewflow-git-")));
  const path = join(root, "repo");
  const template = join(root, "empty-template");
  mkdirSync(path, { recursive: true });
  mkdirSync(template, { recursive: true });

  const git = (
    args: string[],
    cwd: string = path,
    extraEnv?: Record<string, string>,
  ): string =>
    execFileSync("git", args, {
      cwd,
      encoding: "utf8",
      env: extraEnv === undefined ? env : { ...env, ...extraEnv },
    });

  git([
    "init",
    "--quiet",
    `--initial-branch=${branch}`,
    `--template=${template}`,
  ]);
  git(["config", "user.name", "reviewflow test"]);
  git(["config", "user.email", "test@reviewflow.invalid"]);
  git(["config", "commit.gpgsign", "false"]);
  if (remote !== null) git(["remote", "add", "origin", remote]);

  const commit = (cwd: string = path, committedAt?: string): void => {
    git(
      ["commit", "--allow-empty", "--quiet", "-m", "chore: commit"],
      cwd,
      committedAt === undefined
        ? undefined
        : { GIT_AUTHOR_DATE: committedAt, GIT_COMMITTER_DATE: committedAt },
    );
  };

  if (initialCommit) commit();

  return {
    path,
    git,
    commit,
    remove: () => {
      rmSync(root, { recursive: true, force: true });
    },
  };
};

export interface BareRemoteFixture {
  /** pass as `remote` to `createGitRepo`: fetch, pull and push stay local */
  path: string;
  /** someone else's commit landing on `branch`, which leaves a clone behind */
  pushFromElsewhere: (branch: string) => void;
  remove: () => void;
}

/** A local bare repository standing in for GitHub, so no test reaches the network. */
export const createBareRemote = (): BareRemoteFixture => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), "reviewflow-remote-")));
  const path = join(root, "remote.git");
  const elsewhere = join(root, "elsewhere");
  const template = join(root, "empty-template");
  mkdirSync(template, { recursive: true });

  const git = (args: string[], cwd: string = root): string =>
    execFileSync("git", args, { cwd, encoding: "utf8", env });

  git([
    "init",
    "--quiet",
    "--bare",
    "--initial-branch=main",
    `--template=${template}`,
    path,
  ]);

  return {
    path,
    pushFromElsewhere: (branch) => {
      git(["clone", "--quiet", `--template=${template}`, path, elsewhere]);
      git(["config", "user.name", "someone else"], elsewhere);
      git(["config", "user.email", "else@reviewflow.invalid"], elsewhere);
      git(["config", "commit.gpgsign", "false"], elsewhere);
      git(["checkout", "--quiet", branch], elsewhere);
      git(
        ["commit", "--allow-empty", "--quiet", "-m", "chore: elsewhere"],
        elsewhere,
      );
      git(["push", "--quiet", "origin", branch], elsewhere);
      rmSync(elsewhere, { recursive: true, force: true });
    },
    remove: () => {
      rmSync(root, { recursive: true, force: true });
    },
  };
};
