import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { QueryClient } from "@tanstack/react-query";
import { startLiveEvents } from "./liveEvents.tsx";
import { boardQueryKey } from "./reviewflowApi.ts";

vi.mock("./serverBaseUrl.ts", () => ({
  serverBaseUrl: () => "http://127.0.0.1:7450",
}));

class FakeEventSource {
  static readonly CLOSED = 2;
  static last: FakeEventSource | null = null;
  readyState = 0;
  readonly url: string;
  private readonly listeners = new Map<string, (() => void)[]>();

  constructor(url: string) {
    this.url = url;
    FakeEventSource.last = this;
  }

  addEventListener(type: string, listener: () => void): void {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener]);
  }

  emit(type: string): void {
    for (const listener of this.listeners.get(type) ?? []) listener();
  }

  close(): void {
    this.readyState = FakeEventSource.CLOSED;
  }
}

const partKey = ["pullRequest", "acme/web", 12, "part", "checks"];
const diffKey = ["pullRequest", "acme/web", 12, "diff", "a", "b", "show"];

const seeded = (): QueryClient => {
  const client = new QueryClient();
  for (const queryKey of [boardQueryKey, partKey, diffKey]) {
    client.setQueryData(queryKey, { seeded: true });
  }
  return client;
};

const invalidated = (client: QueryClient, queryKey: readonly unknown[]) =>
  client.getQueryState(queryKey)?.isInvalidated;

describe("startLiveEvents", () => {
  beforeEach(() => {
    vi.stubGlobal("EventSource", FakeEventSource);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("reads nothing again on the first connection", () => {
    const client = seeded();
    const stop = startLiveEvents(client);
    FakeEventSource.last!.emit("open");

    expect(invalidated(client, boardQueryKey)).toBe(false);
    expect(invalidated(client, partKey)).toBe(false);
    stop();
  });

  it("reads the board and the parts again after a reconnection, never a diff", () => {
    const client = seeded();
    const stop = startLiveEvents(client);
    const source = FakeEventSource.last!;
    source.emit("open");
    source.emit("error");
    source.emit("open");

    expect(invalidated(client, boardQueryKey)).toBe(true);
    expect(invalidated(client, partKey)).toBe(true);
    expect(invalidated(client, diffKey)).toBe(false);
    stop();
  });
});
