import { monitorEventLoopDelay } from "node:perf_hooks";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { QuerySubscription } from "liwi-store";
import type { PrBucket } from "reviewflow-modules";
import { prBucketsInOrder } from "reviewflow-modules";
import type { ReviewflowPr } from "./mongo.ts";
import type { PrBucketContext } from "./prBucketCriteria.ts";
import { buildPrBucketQuery } from "./prBucketCriteria.ts";
import { toPrSummary } from "./prs/toPrSummary.ts";
import type { TestMongoStores } from "./tests/testMongoStores.ts";
import { createTestMongoStores } from "./tests/testMongoStores.ts";

/*
 * What the webapp server does with the store relay under normal conditions:
 * the hypotheses below, not production measurements. Each user has the board
 * open, one subscription per bucket like `useMyPrsByBucket`.
 */
const USERS_ONLINE = 30;
const OPEN_PRS = 1000;
const SINGLE_WRITE_BATCHES = 20;
const KEYS_PER_SINGLE_WRITE_BATCH = 10;
/** a push to a base branch invalidating `mergeable` on its open pull requests */
const PUSH_BATCH_KEYS = 50;

const MAX_EVENT_LOOP_DELAY_MS = 100;

const accountId = 1;
const userIdAt = (index: number): number => 1000 + (index % USERS_ONLINE);
const user = (index: number): ReviewflowPr["creator"] & {} => ({
  id: userIdAt(index),
  login: `user-${index % USERS_ONLINE}`,
});

const buildPr = (index: number): ReviewflowPr => ({
  _id: `pr-${index}`,
  account: { id: accountId, login: "acme", type: "Organization" },
  repo: { id: 1 + (index % 20), name: `repo-${index % 20}` },
  pr: { number: index },
  commentId: index,
  title: `feat: change ${index}`,
  isDraft: index % 10 === 0,
  isClosed: false,
  creator: user(index),
  assignees: [user(index)],
  baseRef: "main",
  mergeable: "mergeable",
  reviews: {
    approved: index % 4 === 0 ? [user(index + 3)] : [],
    changesRequested: index % 7 === 0 ? [user(index + 4)] : [],
    commented: [],
    dismissed: [],
    reviewRequested: index % 4 === 0 ? [] : [user(index + 1), user(index + 2)],
    teamReviewRequested: [],
    reviewed: index % 3 === 0 ? [user(index + 1)] : [],
  },
  created: new Date(Date.UTC(2026, 0, 1) + index * 60_000),
  updated: new Date(Date.UTC(2026, 0, 1) + index * 60_000),
});

const prKey = (index: number): string => `pr-${index % OPEN_PRS}`;

/** stands for the websocket send of liwi-resources-server, which encodes each change */
const encodeLikeTheWebsocket = (value: unknown): void => {
  JSON.stringify(value);
};

describe("store relay load on the webapp server", () => {
  let stores: TestMongoStores;
  const subscriptions: QuerySubscription[] = [];
  /** per subscription, when it last received a whole result */
  const lastInitialAt: number[] = [];
  let lastCallbackAt = 0;
  let rowsInFirstInitials = 0;

  const waitForQuiet = async (quietMs = 200): Promise<void> => {
    await expect
      .poll(() => performance.now() - lastCallbackAt >= quietMs, {
        timeout: 20_000,
        interval: 50,
      })
      .toBe(true);
  };

  const subscribeToBucket = (
    bucket: PrBucket,
    context: PrBucketContext,
  ): QuerySubscription => {
    const { criteria, sort } = buildPrBucketQuery(bucket, context);
    const subscriptionIndex = subscriptions.length;
    return stores.prs
      .createQueryCollection({
        criteria,
        sort,
        limit: 100,
        transformer: toPrSummary,
      })
      .fetchAndSubscribe((error, changes) => {
        if (error) throw error;
        lastCallbackAt = performance.now();
        for (const change of changes) {
          if (change.type !== "initial") continue;
          if (lastInitialAt[subscriptionIndex] === undefined) {
            rowsInFirstInitials += change.initial.length;
          }
          lastInitialAt[subscriptionIndex] = lastCallbackAt;
        }
        encodeLikeTheWebsocket(changes);
      });
  };

  beforeAll(async () => {
    stores = await createTestMongoStores();
    await stores.db
      .collection<ReviewflowPr>("prs")
      .insertMany(
        Array.from({ length: OPEN_PRS }, (_, index) => buildPr(index)),
      );

    for (let index = 0; index < USERS_ONLINE; index++) {
      const context: PrBucketContext = {
        userId: userIdAt(index),
        accounts: [{ accountId, teams: [] }],
      };
      for (const bucket of prBucketsInOrder) {
        subscriptions.push(subscribeToBucket(bucket, context));
      }
    }
    await Promise.all(subscriptions);
    // empty buckets would measure nothing
    expect(rowsInFirstInitials).toBeGreaterThan(subscriptions.length * 10);
  });

  afterAll(async () => {
    subscriptions.forEach((subscription) => {
      subscription.stop();
    });
    await stores?.dispose();
  });

  it("applies relayed writes and a resync without stalling the event loop", async () => {
    const delay = monitorEventLoopDelay({ resolution: 10 });
    const prs = stores.db.collection<ReviewflowPr>("prs");
    delay.enable();

    for (let batch = 0; batch < SINGLE_WRITE_BATCHES; batch++) {
      const indexes = Array.from(
        { length: KEYS_PER_SINGLE_WRITE_BATCH },
        (_, offset) => batch * KEYS_PER_SINGLE_WRITE_BATCH + offset,
      );
      // half of them leave the review buckets: the windowed subscriptions refetch
      await prs.updateMany({ _id: { $in: indexes.map(prKey) } }, [
        {
          $set: {
            title: { $concat: ["$title", "!"] },
            "reviews.reviewRequested": [],
          },
        },
      ]);
      await stores.prs.notifyChanged(indexes.map(prKey));
    }

    const pushIndexes = Array.from(
      { length: PUSH_BATCH_KEYS },
      (_, offset) => 500 + offset,
    );
    await prs.updateMany(
      { _id: { $in: pushIndexes.map(prKey) } },
      { $set: { mergeable: "unknown" } },
    );
    await stores.prs.notifyChanged(pushIndexes.map(prKey));
    await waitForQuiet();

    const resyncStartedAt = performance.now();
    stores.prs.resync();
    await expect
      .poll(
        () =>
          subscriptions.every(
            (_, index) => (lastInitialAt[index] ?? 0) > resyncStartedAt,
          ),
        { timeout: 20_000 },
      )
      .toBe(true);
    const resyncMs = performance.now() - resyncStartedAt;

    delay.disable();
    const maxDelayMs = delay.max / 1e6;
    const p99DelayMs = delay.percentile(99) / 1e6;
    console.info(
      `${subscriptions.length} subscriptions: event loop delay p99 ${p99DelayMs.toFixed(1)} ms, max ${maxDelayMs.toFixed(1)} ms; resync of every subscription ${resyncMs.toFixed(0)} ms`,
    );

    expect(maxDelayMs).toBeLessThan(MAX_EVENT_LOOP_DELAY_MS);
  });
});
