import { execFile, spawn } from "node:child_process";
import { env } from "node:process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const timeoutMs = 10_000;
const networkTimeoutMs = 60_000;
const defaultMaxBuffer = 4 * 1024 * 1024;
const batchMaxBuffer = 256 * 1024 * 1024;

export interface GitOptions {
  /** a fetch, pull or push: talks to a remote */
  network?: boolean;
  /** bytes of stdout past which git is killed; 4MB unless a caller has its own budget */
  maxBuffer?: number;
  /**
   * Exit status 1 is an answer rather than a failure, as for
   * `diff --no-index`, which exits 1 when the files differ.
   */
  exitOneIsAnswer?: boolean;
  /** kills git when the caller no longer wants the answer */
  signal?: AbortSignal;
}

/**
 * With no terminal (a server, a background job) to answer a credential or passphrase
 * prompt, so one would hang until the timeout and then report a kill rather
 * than the reason. Refusing to prompt makes git fail at once with the reason on
 * stderr, which is what the user reads. A user's own
 * `GIT_SSH_COMMAND` is kept: it is how a custom agent or key is configured.
 */
const networkEnv = (): NodeJS.ProcessEnv => ({
  ...env,
  GIT_TERMINAL_PROMPT: "0",
  GIT_SSH_COMMAND: env.GIT_SSH_COMMAND ?? "ssh -o BatchMode=yes",
});

export const gitFailedCode = "ERR_GIT_FAILED";

/**
 * git's reason, which is not always its first line: a push opens with
 * `To <remote>` and states the rejection on a ` ! [rejected]` line below, and a
 * refused fast-forward prints its `hint:` block before the `fatal:`.
 */
export const reasonLine = (stderr: string): string => {
  const lines = stderr
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line !== "");
  return (
    lines.find((line) => line.startsWith("! ")) ??
    lines.find((line) => /^(?:fatal|error):/.test(line)) ??
    lines.find((line) => !line.startsWith("hint:")) ??
    ""
  );
};

/**
 * A git killed by the timeout has written nothing to stderr, so without this
 * the message names the command and no reason at all.
 */
const failureReason = (error: unknown, timeout: number): string => {
  if (typeof error !== "object" || error === null) return "";
  if ("killed" in error && error.killed === true) {
    return `killed after ${String(timeout / 1000)}s without finishing`;
  }
  return "stderr" in error ? reasonLine(String(error.stderr)) : "";
};

/** git exits 1 on some errors too, which print nothing to stdout */
const isExitOneAnswer = (error: unknown): error is { stdout: string } =>
  typeof error === "object" &&
  error !== null &&
  "code" in error &&
  error.code === 1 &&
  "stdout" in error &&
  typeof error.stdout === "string" &&
  error.stdout !== "";

/**
 * git reads are on-demand: nothing here caches, and every call names the repository it ran in so a failure is actionable.
 *
 * `execFile` with an argument array and no shell, which is what makes a branch
 * name safe to pass through: nothing here is ever interpolated into a command
 * line.  *
 * The message keeps only one stderr line on purpose (`reasonLine`): it is
 * rendered to the user verbatim, and the rest is
 * hints.
 */
export const git = async (
  cwd: string,
  args: string[],
  options: GitOptions = {},
): Promise<string> => {
  const timeout = options.network ? networkTimeoutMs : timeoutMs;
  try {
    const { stdout } = await execFileAsync("git", args, {
      cwd,
      timeout,
      maxBuffer: options.maxBuffer ?? defaultMaxBuffer,
      env: options.network ? networkEnv() : env,
      ...(options.signal === undefined ? {} : { signal: options.signal }),
    });
    return stdout;
  } catch (error) {
    if (options.exitOneIsAnswer && isExitOneAnswer(error)) return error.stdout;
    const reason = failureReason(error, timeout);
    throw Object.assign(
      new Error(
        `git ${args.join(" ")} failed in ${cwd}${reason ? `: ${reason}` : ""}`,
        { cause: error },
      ),
      { code: gitFailedCode },
    );
  }
};

/** `<request> missing`: the request echoes the path, which may contain spaces */
const unansweredHeader = / (?:missing|ambiguous)$/;

const parseBatchOutput = (
  output: Buffer,
  paths: readonly string[],
): Map<string, string> => {
  const contents = new Map<string, string>();
  let offset = 0;
  for (const path of paths) {
    const newline = output.indexOf("\n", offset);
    if (newline === -1) break;
    const header = output.toString("utf8", offset, newline);
    offset = newline + 1;
    if (unansweredHeader.test(header)) continue;
    const [, type, sizeText] = header.split(" ");
    const size = Number(sizeText);
    // past an unreadable header every offset is wrong: stop rather than misattribute
    if (!Number.isSafeInteger(size) || size < 0) break;
    if (type === "blob") {
      contents.set(path, output.toString("utf8", offset, offset + size));
    }
    offset += size + 1;
  }
  return contents;
};

/**
 * Many files of one commit from a single `git cat-file --batch`, rather than a
 * process per file. A path missing at `sha`, or naming no blob, is absent from
 * the answer. The commit must be in the checkout.
 */
export const catFiles = async (
  cwd: string,
  sha: string,
  paths: readonly string[],
): Promise<Map<string, string>> => {
  // a newline ends a batch request: such a path cannot be asked
  const asked = paths.filter((path) => !path.includes("\n"));
  if (asked.length === 0) return new Map();
  const args = ["cat-file", "--batch"];
  return new Promise((resolve, reject) => {
    const child = spawn("git", args, { cwd, env, timeout: timeoutMs });
    const chunks: Buffer[] = [];
    let size = 0;
    let stderr = "";
    child.stdout.on("data", (chunk: Buffer) => {
      size += chunk.length;
      if (size > batchMaxBuffer) {
        child.kill();
        return;
      }
      chunks.push(chunk);
    });
    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString("utf8");
    });
    child.on("error", reject);
    // git exiting before reading every request (not a repo, killed) breaks the
    // pipe; `close` reports why, an unhandled EPIPE would crash the process
    child.stdin.on("error", () => {});
    child.on("close", (code, signal) => {
      if (code === 0) {
        resolve(parseBatchOutput(Buffer.concat(chunks), asked));
        return;
      }
      const reason =
        signal === null
          ? reasonLine(stderr)
          : `killed (${signal}) after reading ${String(size)} bytes`;
      reject(
        Object.assign(
          new Error(
            `git ${args.join(" ")} failed in ${cwd}${reason ? `: ${reason}` : ""}`,
          ),
          { code: gitFailedCode },
        ),
      );
    });
    child.stdin.end(asked.map((path) => `${sha}:${path}\n`).join(""));
  });
};

/** For calls whose failure is an expected answer, e.g. "no remote". */
export const gitOrNull = async (
  cwd: string,
  args: string[],
  options: GitOptions = {},
): Promise<string | null> => {
  try {
    return await git(cwd, args, options);
  } catch {
    return null;
  }
};
