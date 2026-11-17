import { spawn } from "node:child_process";
import { existsSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { env, kill } from "node:process";
import { reasonLine } from "@reviewflow/sdk/git";
import { resolveGh } from "./githubTransport.ts";

export interface ClonePlan {
  ownerRepo: string;
  /** `<folder>/<repo>`, absent until cloned */
  target: string;
}

/** GitHub's own name characters: a name never carries a separator or a `..`. */
const ownerRepoPattern = /^[\w-]+\/[\w.-]+$/;

const isDirectory = (path: string): boolean => {
  try {
    return statSync(path).isDirectory();
  } catch {
    return false;
  }
};

const describeFolders = (repoPaths: string[]): string =>
  repoPaths.length === 0 ? "no repositories folder" : repoPaths.join(", ");

interface PlanCloneParams {
  /** expanded */
  repoPaths: string[];
  ownerRepo: unknown;
  folder: unknown;
}

/**
 * Where `ownerRepo` is cloned, or why it is not. The folder is taken from
 * `repoPaths` and never from the request: no route authenticates, so one
 * writing wherever it was told would write anywhere on the machine. The
 * target is directly under the folder, where `resolveCheckout` and the
 * listing look first.
 */
export const planClone = ({
  repoPaths,
  ownerRepo,
  folder,
}: PlanCloneParams): ClonePlan | { refused: string } => {
  if (typeof ownerRepo !== "string" || !ownerRepoPattern.test(ownerRepo)) {
    return { refused: "ownerRepo must be owner/repo" };
  }
  const repo = ownerRepo.split("/")[1] ?? "";
  if (repo === "." || repo === "..") {
    return { refused: "ownerRepo must be owner/repo" };
  }
  const configured =
    typeof folder === "string" && folder !== ""
      ? repoPaths.find((path) => resolve(path) === resolve(folder))
      : undefined;
  if (configured === undefined) {
    return {
      refused: `folder must be one of the repositories folders: ${describeFolders(repoPaths)}`,
    };
  }
  if (!isDirectory(configured)) {
    return { refused: `${configured} does not exist or is not a directory` };
  }
  const target = join(configured, repo);
  if (existsSync(target)) {
    return {
      refused: `${target} already exists: move it, or clone into another folder`,
    };
  }
  return { ownerRepo, target };
};

const cloneTimeoutMs = 30 * 60_000;

/** As for git's network commands: no terminal answers a prompt, so one fails at once with its reason. */
const noPromptEnv = (): NodeJS.ProcessEnv => ({
  ...env,
  GH_PROMPT_DISABLED: "1",
  GIT_TERMINAL_PROMPT: "0",
  GIT_SSH_COMMAND: env.GIT_SSH_COMMAND ?? "ssh -o BatchMode=yes",
});

/**
 * `gh repo clone`, so the clone follows the user's `gh` login and git
 * protocol (ssh or https) as a clone they typed would. Run in its own process
 * group: a timeout stops gh and the git it started together, and git removes
 * its half-written directory on that signal.
 */
export const cloneWithGh = ({ ownerRepo, target }: ClonePlan): Promise<void> =>
  new Promise((resolvePromise, reject) => {
    const child = spawn(
      resolveGh(),
      ["repo", "clone", ownerRepo, target, "--", "--quiet"],
      {
        detached: true,
        stdio: ["ignore", "ignore", "pipe"],
        env: noPromptEnv(),
      },
    );
    let stderr = "";
    const timer = setTimeout(() => {
      if (child.pid !== undefined) kill(-child.pid, "SIGTERM");
    }, cloneTimeoutMs);
    child.stderr.setEncoding("utf8").on("data", (chunk: string) => {
      stderr += chunk;
    });
    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on("close", (code, signal) => {
      clearTimeout(timer);
      if (code === 0) {
        resolvePromise();
        return;
      }
      const reason =
        signal === null
          ? reasonLine(stderr)
          : `stopped after ${String(cloneTimeoutMs / 60_000)} minutes without finishing`;
      reject(
        new Error(
          `gh repo clone ${ownerRepo} failed${reason === "" ? "" : `: ${reason}`}`,
        ),
      );
    });
  });
