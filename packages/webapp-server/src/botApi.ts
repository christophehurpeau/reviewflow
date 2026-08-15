import { ResourcesServerError } from "liwi-resources-server";

/**
 * Client for the webhook server's internal api: this process holds no github
 * app credentials, so syncing and refreshing slack are delegated to it.
 */

// not PORT: that one is this process's own. The bot serves the internal api on
// a loopback only listener, apart from the public port github delivers to
const getBaseUrl = (): string =>
  (process.env.BOT_INTERNAL_URL || "http://127.0.0.1:3002").replace(/\/+$/, "");

const errorCodeByStatus: Record<number, string> = {
  400: "BAD_REQUEST",
  401: "UNAUTHENTICATED",
  404: "NOT_FOUND",
};

export const callBotApi = async (
  path: string,
  body: Record<string, number | string>,
): Promise<void> => {
  const secret = process.env.INTERNAL_API_SECRET;
  if (!secret) {
    throw new Error("Missing env variable: INTERNAL_API_SECRET");
  }

  const response = await fetch(`${getBaseUrl()}/api/internal${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${secret}`,
    },
    body: JSON.stringify(body),
  }).catch(() => {
    throw new ResourcesServerError(
      "UNAVAILABLE",
      "Could not reach the reviewflow bot",
    );
  });

  if (response.ok) return;

  const errorBody = (await response.json().catch(() => null)) as {
    error?: string;
  } | null;

  throw new ResourcesServerError(
    errorCodeByStatus[response.status] || "UNEXPECTED_ERROR",
    errorBody?.error || "The reviewflow bot rejected the request",
  );
};

/**
 * For the refreshes that only warm the bot's in-memory caches: mongo already
 * holds the change, so a bot that is down must not turn a successful oauth
 * flow into an error page.
 */
export const callBotApiBestEffort = async (
  path: string,
  body: Record<string, number | string>,
): Promise<void> => {
  try {
    await callBotApi(path, body);
  } catch (error) {
    console.error(`Could not notify the bot on ${path}`, error);
  }
};
