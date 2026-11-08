import { describe, expect, it, vi } from "vitest";
import { reviewflowErrorCode } from "./client.ts";
import type { ReviewflowStreamEvent } from "./stream.ts";
import { readReviewflowStream } from "./stream.ts";

const prDetail = (number: number): unknown => ({
  _id: `pr-${String(number)}`,
  ownerRepo: "acme/widgets",
  number,
  title: "a pull request",
  url: `https://github.com/acme/widgets/pull/${String(number)}`,
  headRef: "feat/one",
  state: "open",
  reviewState: "requested",
  checks: { passed: 1, failed: 0, pending: 0 },
  mergeable: "mergeable",
  flowDates: { closedAt: null, lastCommentActivityAt: null },
  updatedAt: "2026-10-18T10:00:00.000Z",
});

const frame = (event: string, data: unknown): string =>
  `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;

/** the chunks as the network delivers them, a frame cut anywhere */
const streamOf = (chunks: string[], { hang = false } = {}): ReadableStream =>
  new ReadableStream({
    start: (controller) => {
      for (const chunk of chunks) {
        controller.enqueue(new TextEncoder().encode(chunk));
      }
      if (!hang) controller.close();
    },
  });

interface Call {
  url: string;
  authorization: string | null;
}

const fakeFetch = (
  answer: () => Response,
): { fetch: typeof globalThis.fetch; calls: Call[] } => {
  const calls: Call[] = [];
  const fetch = ((input: string, init?: RequestInit) => {
    calls.push({
      url: input,
      authorization: new Headers(init?.headers).get("authorization"),
    });
    return Promise.resolve(answer());
  }) as typeof globalThis.fetch;
  return { fetch, calls };
};

const readAll = async (
  fetch: typeof globalThis.fetch,
  { idleTimeoutMs }: { idleTimeoutMs?: number } = {},
): Promise<ReviewflowStreamEvent[]> => {
  const events: ReviewflowStreamEvent[] = [];
  for await (const event of readReviewflowStream({
    url: "https://rf.example",
    token: "rfp_x",
    signal: new AbortController().signal,
    fetch,
    idleTimeoutMs,
  })) {
    events.push(event);
  }
  return events;
};

describe("readReviewflowStream", () => {
  it("reads the scope, ready, then the changes, whatever the chunking", async () => {
    const body = [
      frame("pr", prDetail(1)),
      frame("ready", { serverTime: "2026-10-18T10:00:00.000Z" }),
      frame("heartbeat", { serverTime: "2026-10-18T10:00:25.000Z" }),
      frame("pr", prDetail(2)),
      frame("prRemoved", { _id: "pr-1", reason: "outOfScope" }),
    ].join("");
    const { fetch, calls } = fakeFetch(
      () => new Response(streamOf([body.slice(0, 37), body.slice(37)])),
    );

    const events = await readAll(fetch);

    expect(events.map((event) => event.type)).toEqual([
      "pr",
      "ready",
      "pr",
      "prRemoved",
    ]);
    expect(events[2]).toMatchObject({ pr: { id: "pr-2", number: 2 } });
    expect(events[3]).toEqual({ type: "prRemoved", id: "pr-1" });
    expect(calls).toEqual([
      {
        url: "https://rf.example/api/stream/v1?closedWithinDays=7",
        authorization: "Bearer rfp_x",
      },
    ]);
  });

  it("stops at a reset, and reads CRLF line ends", async () => {
    const body = [
      frame("pr", prDetail(1)),
      frame("reset", { reason: "resync" }),
      frame("pr", prDetail(2)),
    ]
      .join("")
      .replaceAll("\n", "\r\n");
    const { fetch } = fakeFetch(() => new Response(streamOf([body])));

    const events = await readAll(fetch);
    expect(events.map((event) => event.type)).toEqual(["pr", "end"]);
  });

  it("skips a pull request it cannot read rather than ending the stream", async () => {
    const { fetch } = fakeFetch(
      () =>
        new Response(
          streamOf([
            frame("pr", { number: 1 }),
            frame("pr", prDetail(2)),
            frame("ready", {}),
          ]),
        ),
    );

    const events = await readAll(fetch);
    expect(events.map((event) => event.type)).toEqual(["pr", "ready"]);
  });

  it("hands the logger the error of a pull request it cannot read", async () => {
    const { fetch } = fakeFetch(
      () => new Response(streamOf([frame("pr", { number: 1 })])),
    );
    const warn = vi.fn();

    const events: ReviewflowStreamEvent[] = [];
    for await (const event of readReviewflowStream({
      url: "https://rf.example",
      token: "t",
      signal: new AbortController().signal,
      fetch,
      logger: { warn },
    })) {
      events.push(event);
    }
    expect(events).toEqual([]);

    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0]?.[0]).toBe(
      "reviewflow streamed a pull request the client cannot read",
    );
    expect(warn.mock.calls[0]?.[1].error).toBeInstanceOf(Error);
  });

  it("reports a second stream's refusal with its Retry-After", async () => {
    const { fetch } = fakeFetch(() =>
      Response.json(
        {
          error: {
            code: "rateLimited",
            message: "This token already has an open stream",
          },
        },
        { status: 429, headers: { "retry-after": "30" } },
      ),
    );

    await expect(readAll(fetch)).rejects.toMatchObject({
      code: reviewflowErrorCode,
      status: 429,
      retryAfterMs: 30_000,
    });
  });

  it("fails a connection that goes silent past the heartbeat", async () => {
    const { fetch } = fakeFetch(
      () => new Response(streamOf([frame("ready", {})], { hang: true })),
    );

    await expect(readAll(fetch, { idleTimeoutMs: 20 })).rejects.toThrow(
      /went silent/,
    );
  });
});
