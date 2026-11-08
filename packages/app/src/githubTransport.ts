import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { Agent, request } from "node:https";
import { join } from "node:path";
import { env } from "node:process";
import { createGunzip } from "node:zlib";
import type {
  GitHubTransport,
  HttpAnswer,
  HttpRequest,
  SendToGitHub,
} from "@reviewflow/sdk";
import { createGitHubTransport } from "@reviewflow/sdk";

const timeoutMs = 30_000;
const apiHost = "api.github.com";

export const ghMissingCode = "ERR_GH_MISSING";

/**
 * Started from a launcher or an editor, the server may inherit a PATH without
 * homebrew, where `gh` usually lives. Probed at call time, and only a
 * successful resolution is remembered, so installing `gh` while the server
 * runs is picked up on the next request.
 */
const fallbackDirectories = ["/opt/homebrew/bin", "/usr/local/bin", "/usr/bin"];

let resolvedGhPath: string | null = null;

export const resolveGh = (): string => {
  if (resolvedGhPath !== null) return resolvedGhPath;

  const override = env.REVIEWFLOW_APP_GH_PATH;
  const candidates =
    override === undefined || override === ""
      ? [
          ...(env.PATH?.split(":").filter(Boolean) ?? []),
          ...fallbackDirectories,
        ].map((directory) => join(directory, "gh"))
      : [override];

  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      resolvedGhPath = candidate;
      return candidate;
    }
  }

  throw Object.assign(
    new Error(
      "gh was not found: install the GitHub CLI, or point REVIEWFLOW_APP_GH_PATH at it",
    ),
    { code: ghMissingCode },
  );
};

const firstLine = (text: string): string =>
  text.split("\n", 1)[0]?.trim() ?? "";

const spawnGh = (
  args: string[],
): Promise<{ stdout: string; stderr: string; code: number | null }> =>
  new Promise((resolve, reject) => {
    const child = spawn(resolveGh(), args, {
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
    }, timeoutMs);
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk: string) => {
      stderr += chunk;
    });
    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ stdout, stderr, code });
    });
  });

/** `gh auth token`: the user's own login, for the token alone. */
export const readGhToken = async (): Promise<string> => {
  const { stdout, stderr, code } = await spawnGh([
    "auth",
    "token",
    "--hostname",
    "github.com",
  ]);
  const token = stdout.trim();
  if (code !== 0 || token === "") {
    const detail = firstLine(stderr);
    throw new Error(
      `gh has no GitHub token${detail === "" ? "" : `: ${detail}`}`,
    );
  }
  return token;
};

/**
 * Node's `fetch` drops an idle connection after 4s; this agent keeps it until
 * GitHub closes it.
 */
const agent = new Agent({ keepAlive: true });

export const sendWithToken = (
  { method, path, accept, body }: HttpRequest,
  token: string,
): Promise<HttpAnswer> =>
  new Promise((resolve, reject) => {
    const outgoing = request(
      {
        host: apiHost,
        path: `/${path}`,
        method,
        agent,
        signal: AbortSignal.timeout(timeoutMs),
        headers: {
          authorization: `bearer ${token}`,
          accept,
          "accept-encoding": "gzip",
          "user-agent": "reviewflow-app",
          "x-github-api-version": "2022-11-28",
          ...(body === undefined
            ? {}
            : {
                "content-type": "application/json",
                "content-length": Buffer.byteLength(body),
              }),
        },
      },
      (incoming) => {
        const stream =
          incoming.headers["content-encoding"] === "gzip"
            ? incoming.pipe(createGunzip())
            : incoming;
        let text = "";
        stream.setEncoding("utf8");
        stream.on("data", (chunk: string) => {
          text += chunk;
        });
        stream.on("error", reject);
        stream.on("end", () => {
          resolve({ status: incoming.statusCode ?? 0, body: text });
        });
      },
    );
    outgoing.on("error", reject);
    outgoing.end(body);
  });

const unauthorized = 401;

/**
 * The token is read once and held in memory only; a 401 drops it and the
 * request is sent once more with a fresh read, so a `gh auth login` done
 * meanwhile is picked up. A failed read is not remembered.
 */
export const createAuthenticatedSend = ({
  readToken,
  sendRaw,
}: {
  readToken: () => Promise<string>;
  sendRaw: (request: HttpRequest, token: string) => Promise<HttpAnswer>;
}): SendToGitHub => {
  let tokenPromise: Promise<string> | null = null;
  const token = (): Promise<string> => {
    tokenPromise ??= readToken().catch((error: unknown) => {
      tokenPromise = null;
      throw error;
    });
    return tokenPromise;
  };

  return async (httpRequest) => {
    const answer = await sendRaw(httpRequest, await token());
    if (answer.status !== unauthorized) return answer;
    tokenPromise = null;
    return sendRaw(httpRequest, await token());
  };
};

export const createGhTransport = (): GitHubTransport =>
  createGitHubTransport(
    createAuthenticatedSend({ readToken: readGhToken, sendRaw: sendWithToken }),
  );
