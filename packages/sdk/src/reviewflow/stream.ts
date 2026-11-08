import type { ReviewflowPrDetail } from "./client.ts";
import {
  fail,
  isReviewflowFailure,
  readPrDetail,
  responseFailure,
} from "./client.ts";

/**
 * `GET /api/stream/v1` (`reviewflow/docs/api.md`): every pull request in the
 * reader's scope as `pr` events, then `ready`, then each change as the whole
 * pull request again. There is no resume: a reconnection sends the scope anew.
 */

/** reviewflow heartbeats every 25s: two missed is a dead connection, a laptop that slept */
export const streamIdleTimeoutMs = 60_000;
/**
 * Pull requests closed while no stream was open still reach the tracked
 * branches at the next connection, as long as it is within this many days.
 */
export const streamClosedWithinDays = 7;

export type ReviewflowStreamEvent =
  | { type: "end"; reason: string }
  | { type: "pr"; pr: ReviewflowPrDetail }
  | { type: "prRemoved"; id: string }
  | { type: "ready" };

/** Optional sink for what the stream drops; nothing is logged without one. */
export interface ReviewflowStreamLogger {
  /** `error` is the thrown value itself, for a caller that serializes its stack */
  warn: (message: string, context: { error: unknown }) => void;
}

interface Frame {
  event: string;
  data: string;
}

const parseFrame = (block: string): Frame => {
  let event = "message";
  const data: string[] = [];
  for (const line of block.split("\n")) {
    if (line.startsWith(":")) continue;
    const separator = line.indexOf(":");
    const field = separator === -1 ? line : line.slice(0, separator);
    const value =
      separator === -1 ? "" : line.slice(separator + 1).replace(/^ /, "");
    if (field === "event") event = value;
    else if (field === "data") data.push(value);
  }
  return { event, data: data.join("\n") };
};

const parseData = (frame: Frame): unknown => {
  try {
    return JSON.parse(frame.data) as unknown;
  } catch {
    return null;
  }
};

/** null for a frame that changes nothing: a heartbeat, an event added later */
const toStreamEvent = (
  frame: Frame,
  logger: ReviewflowStreamLogger | undefined,
): ReviewflowStreamEvent | null => {
  switch (frame.event) {
    case "pr": {
      try {
        return { type: "pr", pr: readPrDetail(parseData(frame)) };
      } catch (error) {
        // one unreadable pull request must not end the stream for the others
        logger?.warn(
          "reviewflow streamed a pull request the client cannot read",
          { error },
        );
        return null;
      }
    }
    case "prRemoved": {
      const data = parseData(frame) as { _id?: unknown } | null;
      return typeof data?._id === "string"
        ? { type: "prRemoved", id: data._id }
        : null;
    }
    case "ready":
      return { type: "ready" };
    case "scopeChanged":
      return { type: "end", reason: "scopeChanged" };
    case "reset": {
      const data = parseData(frame) as { reason?: unknown } | null;
      return {
        type: "end",
        reason: `reset: ${typeof data?.reason === "string" ? data.reason : "unknown"}`,
      };
    }
    default:
      return null;
  }
};

interface ReadReviewflowStreamParams {
  url: string;
  token: string;
  signal: AbortSignal;
  /** injected by tests: nothing in the suite reaches the network */
  fetch?: typeof globalThis.fetch;
  idleTimeoutMs?: number;
  logger?: ReviewflowStreamLogger;
}

/**
 * Yields until the server ends the stream (`end`, or the body closing) and
 * throws on a refusal or a connection gone silent, so the caller decides when
 * to connect again. Aborting `signal` ends it quietly.
 */
export async function* readReviewflowStream({
  url,
  token,
  signal,
  fetch = globalThis.fetch,
  idleTimeoutMs = streamIdleTimeoutMs,
  logger,
}: ReadReviewflowStreamParams): AsyncGenerator<ReviewflowStreamEvent> {
  const controller = new AbortController();
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
  // the body is cancelled too: a dead socket does not always reject a read
  const cancel = (): void => {
    controller.abort();
    reader?.cancel().catch(() => undefined);
  };
  signal.addEventListener("abort", cancel, { once: true });
  let silent = false;
  let idle: ReturnType<typeof setTimeout> | undefined;
  const armIdle = (): void => {
    clearTimeout(idle);
    idle = setTimeout(() => {
      silent = true;
      cancel();
    }, idleTimeoutMs);
  };
  const silence = (): Error =>
    fail(
      `reviewflow's stream went silent for ${String(idleTimeoutMs / 1000)}s`,
    );

  try {
    armIdle();
    const query = new URLSearchParams({
      closedWithinDays: String(streamClosedWithinDays),
    });
    const response = await fetch(`${url}/api/stream/v1?${query.toString()}`, {
      headers: {
        authorization: `Bearer ${token}`,
        accept: "text/event-stream",
      },
      signal: controller.signal,
    });
    if (!response.ok) throw await responseFailure(response);
    if (response.body === null) {
      throw fail("reviewflow answered the stream with no body");
    }

    reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      armIdle();
      buffer = (buffer + decoder.decode(value, { stream: true })).replaceAll(
        "\r\n",
        "\n",
      );
      let end = buffer.indexOf("\n\n");
      while (end !== -1) {
        const event = toStreamEvent(parseFrame(buffer.slice(0, end)), logger);
        buffer = buffer.slice(end + 2);
        if (event !== null) {
          yield event;
          if (event.type === "end") return;
        }
        end = buffer.indexOf("\n\n");
      }
    }
    if (silent) throw silence();
  } catch (error) {
    if (signal.aborted) return;
    if (silent) throw silence();
    if (isReviewflowFailure(error)) throw error;
    const cause = error instanceof Error ? error.message : String(error);
    throw fail(`reviewflow's stream could not be read at ${url}: ${cause}`);
  } finally {
    clearTimeout(idle);
    signal.removeEventListener("abort", cancel);
    cancel();
  }
}
