/**
 * Redeliver failed GitHub App webhook deliveries.
 *
 * Usage (run from packages/reviewflow):
 *   APP_ID=<app id> PRIVATE_KEY_PATH=<key.pem> \
 *     node scripts/redeliver-webhook-deliveries.ts [--redeliver] [--hours=24]
 *       [--event=pull_request] [--limit=N] [--wait-healthy]
 *
 * For prod (github.com/settings/apps/reviewflow): APP_ID=10678 (public, GET
 * /apps/reviewflow), PRIVATE_KEY_PATH=private_key/prod_key.pem. The script
 * prints the resolved app slug before doing anything, so a wrong key/id pair
 * is caught immediately.
 *
 * Default is a dry run: it only lists what it would redeliver.
 *
 * A `POST .../attempts` call only means GitHub accepted the redeliver
 * request (202); it says nothing about whether the retry actually reached
 * the webhook. The only trustworthy signal is a delivery record for that guid
 * in `GET /app/hook/deliveries`, so this script never redelivers a guid that
 * has any known successful attempt, and persists every confirmed success to a
 * state file so that guarantee survives a later run using a narrower --hours
 * window.
 *
 * Every request retries network errors, 5xx and rate limits on its own.
 * --wait-healthy makes those retries unbounded instead of giving up after a
 * few attempts, which queues a resume across an ongoing GitHub incident (see
 * githubstatus.com) without babysitting it.
 */

/* eslint-disable no-console -- this is a cli script, its output is the point */

import { createSign } from "node:crypto";
import { readFileSync, renameSync, writeFileSync } from "node:fs";
import { argv, env, exit } from "node:process";
import { setTimeout as sleep } from "node:timers/promises";
import { fileURLToPath } from "node:url";

const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

const nowIso = (): string => new Date().toISOString();

const appId = env.APP_ID;
const privateKeyPath = env.PRIVATE_KEY_PATH;

if (!appId || !privateKeyPath) {
  console.error(
    "APP_ID and PRIVATE_KEY_PATH env vars are required, both for the prod app",
  );
  exit(1);
}

const args = argv.slice(2);
const booleanFlags = ["--redeliver", "--wait-healthy"];
const valueFlags = ["hours", "event", "limit"];

const unknownArg = args.find(
  (arg) =>
    !booleanFlags.includes(arg) &&
    !valueFlags.some((name) => arg.startsWith(`--${name}=`)),
);
if (unknownArg) {
  console.error(
    `unknown argument "${unknownArg}", expected ${[...booleanFlags, ...valueFlags.map((name) => `--${name}=`)].join(", ")}`,
  );
  exit(1);
}

const readFlag = (name: string): string | undefined => {
  const prefix = `--${name}=`;
  return args.find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
};

interface ReadPositiveNumberFlagParams {
  name: string;
  defaultValue: number;
}

function readPositiveNumberFlag({
  name,
  defaultValue,
}: ReadPositiveNumberFlagParams): number {
  const raw = readFlag(name);
  if (raw === undefined) return defaultValue;
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) {
    console.error(`--${name} must be a positive number, got "${raw}"`);
    exit(1);
  }
  return value;
}

const doRedeliver = args.includes("--redeliver");
const waitHealthy = args.includes("--wait-healthy");
const hoursWindow = readPositiveNumberFlag({ name: "hours", defaultValue: 24 });
const limit = readPositiveNumberFlag({ name: "limit", defaultValue: Infinity });
const eventFilter = readFlag("event");
const since = Date.now() - hoursWindow * 3600 * 1000;

const privateKey = ((): string => {
  try {
    return readFileSync(privateKeyPath, "utf8");
  } catch (error) {
    console.error(
      `could not read PRIVATE_KEY_PATH (${privateKeyPath}): ${errorMessage(error)}`,
    );
    exit(1);
  }
})();

const stateFilePath =
  env.STATE_FILE ??
  fileURLToPath(new URL("./.redeliver-state.json", import.meta.url));
const stateRetentionMs = 30 * 24 * 3600 * 1000;

/** guid -> delivered_at of the attempt that confirmed it. */
type ConfirmedOkGuids = Map<string, string>;

function readState(): ConfirmedOkGuids {
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(stateFilePath, "utf8"));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      console.error(
        `ignoring unreadable state file ${stateFilePath}: ${errorMessage(error)}`,
      );
    }
    return new Map();
  }

  if (typeof parsed !== "object" || parsed === null) return new Map();
  const { confirmedOk, confirmedOkGuids } = parsed as {
    confirmedOk?: Record<string, string>;
    confirmedOkGuids?: string[];
  };
  if (confirmedOk) return new Map(Object.entries(confirmedOk));
  // Legacy shape, an untimestamped array: keep it, dated from this run.
  if (Array.isArray(confirmedOkGuids)) {
    return new Map(confirmedOkGuids.map((guid) => [guid, nowIso()]));
  }
  return new Map();
}

function writeState(confirmedOk: ConfirmedOkGuids): void {
  const oldest = Date.now() - stateRetentionMs;
  const kept = [...confirmedOk].filter(
    ([, confirmedAt]) => new Date(confirmedAt).getTime() >= oldest,
  );
  const tmpPath = `${stateFilePath}.tmp`;
  writeFileSync(
    tmpPath,
    JSON.stringify({ confirmedOk: Object.fromEntries(kept) }, null, 2),
  );
  renameSync(tmpPath, stateFilePath);
}

function base64Url(input: object | string): string {
  return Buffer.from(
    typeof input === "string" ? input : JSON.stringify(input),
  ).toString("base64url");
}

function createJwt(): string {
  const nowSeconds = Math.floor(Date.now() / 1000);
  const payload = {
    iat: nowSeconds - 60,
    exp: nowSeconds + 9 * 60,
    iss: appId,
  };
  const data = `${base64Url({ alg: "RS256", typ: "JWT" })}.${base64Url(payload)}`;
  const signature = createSign("RSA-SHA256")
    .update(data)
    .sign(privateKey)
    .toString("base64url");
  return `${data}.${signature}`;
}

// The run can outlast a JWT's 10 min lifetime, so mint a fresh one every 5 min.
let jwt = createJwt();
let jwtMintedAt = Date.now();
function currentJwt(): string {
  if (Date.now() - jwtMintedAt > 5 * 60 * 1000) {
    jwt = createJwt();
    jwtMintedAt = Date.now();
  }
  return jwt;
}

async function discardBody(response: Response): Promise<void> {
  try {
    await response.body?.cancel();
  } catch {
    // an already-errored body is nothing to recover from here
  }
}

const maxRateLimitWaitSeconds = 3600;

function rateLimitWaitSeconds(response: Response): number | undefined {
  if (response.status !== 403 && response.status !== 429) return undefined;

  const retryAfter = Number(response.headers.get("retry-after"));
  if (Number.isFinite(retryAfter) && retryAfter > 0) {
    return Math.min(retryAfter, maxRateLimitWaitSeconds);
  }

  if (response.headers.get("x-ratelimit-remaining") !== "0") return undefined;
  const resetSeconds = Number(response.headers.get("x-ratelimit-reset"));
  if (!Number.isFinite(resetSeconds)) return undefined;
  return Math.min(
    Math.max(resetSeconds - Math.floor(Date.now() / 1000), 1),
    maxRateLimitWaitSeconds,
  );
}

const requestTimeoutMs = 30_000;
const transientAttempts = 5;
const maxBackoffMs = 60_000;
const maxRateLimitWaits = 10;

interface GithubApiParams {
  path: string;
  method?: string;
}

async function githubApi({
  path,
  method = "GET",
}: GithubApiParams): Promise<Response> {
  let rateLimitWaits = 0;

  for (let attempt = 1; ; attempt++) {
    let response: Response | undefined;
    let fetchError: unknown;

    try {
      response = await fetch(`https://api.github.com${path}`, {
        method,
        signal: AbortSignal.timeout(requestTimeoutMs),
        headers: {
          authorization: `Bearer ${currentJwt()}`,
          accept: "application/vnd.github+json",
          "x-github-api-version": "2022-11-28",
          "user-agent": "reviewflow-redeliver-script",
        },
      });
    } catch (error) {
      fetchError = error;
    }

    if (response) {
      const waitSeconds = rateLimitWaitSeconds(response);
      if (waitSeconds !== undefined && rateLimitWaits < maxRateLimitWaits) {
        rateLimitWaits++;
        await discardBody(response);
        console.log(
          `${nowIso()} rate limited on ${method} ${path}, waiting ${waitSeconds}s`,
        );
        await sleep(waitSeconds * 1000);
        continue;
      }
      if (response.status < 500) return response;
    }

    const failureReason = response
      ? `${response.status} ${response.statusText}`
      : errorMessage(fetchError);

    if (!waitHealthy && attempt >= transientAttempts) {
      if (response) return response;
      throw new Error(
        `${method} ${path} failed after ${attempt} attempts: ${failureReason}`,
      );
    }

    if (response) await discardBody(response);
    const backoffMs = Math.min(2 ** (attempt - 1) * 1000, maxBackoffMs);
    console.log(
      `${nowIso()} ${method} ${path} failed (${failureReason}), retrying in ${backoffMs / 1000}s`,
    );
    await sleep(backoffMs);
  }
}

function parseNextCursor(link: string | null): string | undefined {
  const next = link?.split(",").find((part) => part.includes('rel="next"'));
  const url = next?.match(/<([^>]+)>/)?.[1];
  if (!url) return undefined;
  try {
    return new URL(url).searchParams.get("cursor") ?? undefined;
  } catch {
    return undefined;
  }
}

interface Delivery {
  /** 19-digit, beyond Number.MAX_SAFE_INTEGER, so kept as a string. */
  id: string;
  guid: string;
  delivered_at: string;
  redelivery: boolean;
  status: string;
  status_code: number;
  event: string;
  action: string | null;
  repository_id: number | null;
}

const isDeliverySuccessful = (delivery: Delivery): boolean =>
  delivery.status_code >= 200 && delivery.status_code < 300;

const describeDelivery = (delivery: Delivery): string =>
  `${delivery.delivered_at} ${delivery.id} ${delivery.event}${delivery.action ? `.${delivery.action}` : ""} -> ${delivery.status_code} ${delivery.status}`;

const appRes = await githubApi({ path: "/app" });
if (!appRes.ok) {
  console.error(`auth failed: ${appRes.status} ${await appRes.text()}`);
  exit(1);
}
const app = (await appRes.json()) as { slug: string; id: number };
console.log(`authenticated as app ${app.slug} (${app.id})`);

const deliveries: Delivery[] = [];
let cursor: string | undefined;

for (;;) {
  const res = await githubApi({
    path: `/app/hook/deliveries?per_page=100${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`,
  });
  if (!res.ok) {
    console.error(`list failed: ${res.status} ${await res.text()}`);
    exit(1);
  }
  // Delivery ids overflow the double precision JSON.parse gives them, so
  // quote them before parsing.
  const body = await res.text();
  const page = JSON.parse(
    body.replaceAll(/"id":\s*(\d+)/g, '"id":"$1"'),
  ) as Delivery[];

  const reachedWindowEnd = page.some((delivery) => {
    if (new Date(delivery.delivered_at).getTime() < since) return true;
    deliveries.push(delivery);
    return false;
  });
  if (reachedWindowEnd) break;

  const nextCursor = parseNextCursor(res.headers.get("link"));
  if (!nextCursor || nextCursor === cursor) break;
  cursor = nextCursor;
}

// Keep only the most recent delivery per guid: it is the one worth reporting.
const latestByGuid = new Map<string, Delivery>();
for (const delivery of deliveries) {
  const known = latestByGuid.get(delivery.guid);
  if (
    !known ||
    new Date(delivery.delivered_at) > new Date(known.delivered_at)
  ) {
    latestByGuid.set(delivery.guid, delivery);
  }
}

// Any successful attempt means the payload was processed, whether or not a
// later attempt failed, so it must never be redelivered again.
const confirmedOk = readState();
for (const delivery of deliveries) {
  if (isDeliverySuccessful(delivery)) {
    confirmedOk.set(delivery.guid, delivery.delivered_at);
  }
}
writeState(confirmedOk);

const failed = [...latestByGuid.values()]
  .filter((delivery) => !confirmedOk.has(delivery.guid))
  .filter((delivery) => !eventFilter || delivery.event === eventFilter)
  // Oldest first, so events replay in the order they happened.
  .toSorted(
    (a, b) =>
      new Date(a.delivered_at).getTime() - new Date(b.delivered_at).getTime(),
  )
  .slice(0, limit);

console.log(
  `${deliveries.length} deliveries in the last ${hoursWindow}h, ${failed.length} still failing (unique guid, excluding ${confirmedOk.size} confirmed ok)`,
);
for (const delivery of failed) {
  console.log(`  ${describeDelivery(delivery)}`);
}

if (!doRedeliver) {
  console.log("\ndry run, pass --redeliver to actually redeliver");
  exit(0);
}

type RedeliverResult = { accepted: false; detail: string } | { accepted: true };

async function redeliver(delivery: Delivery): Promise<RedeliverResult> {
  try {
    const res = await githubApi({
      path: `/app/hook/deliveries/${delivery.id}/attempts`,
      method: "POST",
    });
    if (res.ok) {
      await discardBody(res);
      return { accepted: true };
    }
    return { accepted: false, detail: `${res.status} ${await res.text()}` };
  } catch (error) {
    return { accepted: false, detail: errorMessage(error) };
  }
}

// GitHub itself going down mid-run looks like a string of consecutive
// failures; stop instead of burning through the rest of the list against a
// dead API. Re-run with --wait-healthy to resume: deliveries that failed to
// redeliver are still "failed" next time round.
const circuitBreakerThreshold = 8;
const pauseBetweenRedeliveriesMs = 400;

let acceptedCount = 0;
let rejectedCount = 0;
let consecutiveFailures = 0;

for (const [index, delivery] of failed.entries()) {
  const progress = `${index + 1}/${failed.length}`;
  const result = await redeliver(delivery);

  if (result.accepted) {
    acceptedCount++;
    consecutiveFailures = 0;
    console.log(`  ${progress} redelivered ${delivery.id} ${delivery.event}`);
  } else {
    rejectedCount++;
    consecutiveFailures++;
    console.error(
      `  ${progress} redeliver ${delivery.id} failed: ${result.detail}`,
    );
  }

  if (consecutiveFailures >= circuitBreakerThreshold) {
    console.error(
      `\n${consecutiveFailures} consecutive failures, aborting at ${progress} (accepted ${acceptedCount}, rejected ${rejectedCount}).`,
    );
    console.error(
      "Re-run with --wait-healthy --redeliver once GitHub recovers.",
    );
    exit(1);
  }

  if (index + 1 < failed.length) await sleep(pauseBetweenRedeliveriesMs);
}

console.log(
  `queued ${acceptedCount} redeliveries, ${rejectedCount} rejected by the API. Re-run without --redeliver to check which ones actually succeeded.`,
);
