import { describe, expect, it, vi } from "vitest";
import type {
  Query,
  QueryResult,
  QuerySubscription,
  SubscribeCallback,
} from "liwi-store";
import type { MongoStores, OrgMember } from "reviewflow-core";
import type { PrBucket } from "reviewflow-modules";
import type { AuthenticatedWsUser } from "./getAuthenticatedUser.ts";
import { createMembershipScopes } from "./membershipScopes.ts";
import { createPrsService } from "./prsService.ts";
import {
  createSubscriptionSlots,
  limitQuerySubscriptions,
} from "./subscriptionLimits.ts";

type OrgMembersListener = Parameters<MongoStores["orgMembers"]["subscribe"]>[0];

/** the membership cache is keyed on this object, so no two cases may share one */
const createLoggedInUser = (): AuthenticatedWsUser => ({
  id: 42,
  login: "christophehurpeau",
  accessToken: "token",
});

const orgMember = (
  orgId: number,
  teamIds: number[] = [],
  userId = 42,
): OrgMember => ({
  _id: `${orgId}_${userId}`,
  org: { id: orgId, login: `org-${orgId}` },
  user: { id: userId, login: `user-${userId}` },
  teams: teamIds.map((id) => ({ id, name: `team-${id}`, slug: `team-${id}` })),
  created: new Date(),
  updated: new Date(),
});

interface FakePrsQuery extends Query<unknown[], Record<string, never>> {
  criteria: unknown;
  liveCount: number;
}

interface Harness {
  user: AuthenticatedWsUser;
  members: OrgMember[];
  listeners: Set<OrgMembersListener>;
  queries: FakePrsQuery[];
  slots: ReturnType<typeof createSubscriptionSlots>;
  received: Parameters<SubscribeCallback<any, any>>[];
  open: (options: {
    accountId: number | null;
    bucket: PrBucket;
    userKey?: string;
  }) => Promise<{ subscription: QuerySubscription }>;
  lastCriteria: () => string;
}

const settle = (): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, 0);
  });

const createHarness = (members: OrgMember[]): Harness => {
  const listeners = new Set<OrgMembersListener>();
  const queries: FakePrsQuery[] = [];
  const received: Harness["received"] = [];
  const slots = createSubscriptionSlots({ maxTotal: 10, maxPerUser: 10 });
  const user = createLoggedInUser();

  const mongoStores: any = {
    orgMembers: {
      findAll: () => Promise.resolve(members),
      findOne: ({ "org.id": orgId }: Record<string, number>) =>
        Promise.resolve(
          members.find((member) => member.org.id === orgId) ?? null,
        ),
      subscribe: (listener: OrgMembersListener) => {
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
    },
    prs: {
      createQueryCollection: ({ criteria }: { criteria: unknown }) => {
        const result: QueryResult<unknown[]> = {
          result: [],
          meta: { total: 0 },
          info: { keyPath: "_id" },
        };
        const query: FakePrsQuery = {
          criteria,
          liveCount: 0,
          changeParams: vi.fn(),
          changePartialParams: vi.fn(),
          fetch: (onFulfilled) => Promise.resolve(onFulfilled(result)),
          fetchAndSubscribe: (callback) => {
            query.liveCount++;
            callback(null, [
              {
                type: "initial",
                initial: [criteria],
                meta: result.meta,
                queryInfo: result.info,
              },
            ]);
            const stop = (): void => {
              query.liveCount--;
            };
            return {
              stop,
              cancel: stop,
              then: (onFulfilled, onRejected) =>
                Promise.resolve().then(onFulfilled, onRejected),
            };
          },
          subscribe: (callback) => query.fetchAndSubscribe(callback),
        };
        queries.push(query);
        return query;
      },
    },
  };
  const service = createPrsService(
    { mongoStores },
    createMembershipScopes(mongoStores.orgMembers),
  );

  const harness: Harness = {
    user,
    get members() {
      return members;
    },
    set members(next) {
      members = next;
    },
    listeners,
    queries,
    slots,
    received,
    lastCriteria: () => JSON.stringify(queries.at(-1)?.criteria),
    open: async ({ accountId, bucket, userKey = "42" }) => {
      const query = await service.queries.queryMyPrs(
        { accountId, bucket },
        user,
      );
      const limited = limitQuerySubscriptions(
        query as Query<any, any>,
        () => slots.acquire(userKey),
        vi.fn(),
      );
      return {
        subscription: limited.fetchAndSubscribe((error, changes) => {
          received.push([error, changes]);
        }),
      };
    },
  };

  return harness;
};

const emit = (harness: Harness, action: Parameters<OrgMembersListener>[0]) => {
  harness.listeners.forEach((listener) => listener(action));
};

const lastInitial = (harness: Harness): unknown[] => {
  const [, changes] = harness.received.at(-1)!;
  const initial = changes.find(({ type }) => type === "initial");
  return initial && "initial" in initial ? initial.initial : [];
};

describe("a prs subscription following the memberships of its user", () => {
  it("adds an org the user joined, from a local write", async () => {
    const harness = createHarness([orgMember(1)]);
    await harness.open({ accountId: null, bucket: "ready-to-merge" });
    expect(harness.lastCriteria()).toContain('"account.id":{"$in":[42,1]}');

    const joined = orgMember(2);
    harness.members = [...harness.members, joined];
    emit(harness, { type: "inserted", next: [joined] });
    await settle();

    expect(harness.lastCriteria()).toContain('"account.id":{"$in":[42,1,2]}');
    expect(harness.received).toHaveLength(2);
    expect(lastInitial(harness)).toHaveLength(1);
  });

  it("drops an org the user left, from a relayed deletion known by its key only", async () => {
    const harness = createHarness([orgMember(1), orgMember(2)]);
    await harness.open({ accountId: null, bucket: "ready-to-merge" });

    harness.members = [orgMember(1)];
    emit(harness, { type: "changed", keys: ["2_42"], next: [] });
    await settle();

    expect(harness.lastCriteria()).toContain('"account.id":{"$in":[42,1]}');
    expect(harness.received).toHaveLength(2);
  });

  it("follows the teams of a membership, from a relayed change", async () => {
    const harness = createHarness([orgMember(1, [10])]);
    await harness.open({ accountId: null, bucket: "requested-reviews" });
    expect(harness.lastCriteria()).toContain(
      '"reviews.teamReviewRequested.id":{"$in":[10]}',
    );

    const changed = orgMember(1, [10, 11]);
    harness.members = [changed];
    emit(harness, { type: "changed", keys: ["1_42"], next: [changed] });
    await settle();

    expect(harness.lastCriteria()).toContain(
      '"reviews.teamReviewRequested.id":{"$in":[10,11]}',
    );
    expect(harness.received).toHaveLength(2);
  });

  it("follows the teams of a membership, from a local write", async () => {
    const prev = orgMember(1, [10]);
    const harness = createHarness([prev]);
    await harness.open({ accountId: null, bucket: "requested-reviews" });

    const next = orgMember(1, []);
    harness.members = [next];
    emit(harness, { type: "updated", changes: [[prev, next]] });
    await settle();

    expect(harness.lastCriteria()).not.toContain("teamReviewRequested");
    expect(harness.received).toHaveLength(2);
  });

  it("keeps its subscription when a write leaves the scope unchanged", async () => {
    const prev = orgMember(1);
    const harness = createHarness([prev]);
    await harness.open({ accountId: null, bucket: "ready-to-merge" });

    emit(harness, { type: "updated", changes: [[prev, { ...prev }]] });
    await settle();

    expect(harness.queries).toHaveLength(1);
    expect(harness.received).toHaveLength(1);
  });

  it("ignores the memberships of another user", async () => {
    const harness = createHarness([orgMember(1)]);
    await harness.open({ accountId: null, bucket: "ready-to-merge" });

    const other = orgMember(5, [], 7);
    emit(harness, { type: "inserted", next: [other] });
    emit(harness, { type: "changed", keys: ["5_7"], next: [other] });
    await settle();

    expect(harness.queries).toHaveLength(1);
  });

  it("reads the scope again after a resync", async () => {
    const harness = createHarness([orgMember(1)]);
    await harness.open({ accountId: null, bucket: "ready-to-merge" });

    harness.members = [orgMember(1), orgMember(3)];
    emit(harness, { type: "resync" });
    await settle();

    expect(harness.lastCriteria()).toContain('"account.id":{"$in":[42,1,3]}');
  });

  it("stops exposing an org once its membership is removed, and exposes it again when restored", async () => {
    const harness = createHarness([orgMember(1), orgMember(2)]);
    await harness.open({ accountId: 2, bucket: "ready-to-merge" });
    expect(harness.lastCriteria()).toContain('"account.id":{"$in":[2]}');

    harness.members = [orgMember(1)];
    emit(harness, { type: "changed", keys: ["2_42"], next: [] });
    await settle();

    expect(harness.lastCriteria()).toBe(JSON.stringify({ _id: { $in: [] } }));
    expect(harness.queries.map(({ liveCount }) => liveCount)).toEqual([0, 1]);

    const restored = orgMember(2);
    harness.members = [orgMember(1), restored];
    emit(harness, { type: "inserted", next: [restored] });
    await settle();

    expect(harness.lastCriteria()).toContain('"account.id":{"$in":[2]}');
    expect(harness.queries.map(({ liveCount }) => liveCount)).toEqual([
      0, 0, 1,
    ]);
  });

  it("does not watch a query on the user's own account", async () => {
    const harness = createHarness([orgMember(1)]);
    await harness.open({ accountId: 42, bucket: "ready-to-merge" });

    expect(harness.listeners.size).toBe(0);
  });

  it("holds one slot across swaps, and frees it on stop", async () => {
    const harness = createHarness([orgMember(1)]);
    const { subscription } = await harness.open({
      accountId: null,
      bucket: "ready-to-merge",
    });
    expect(harness.slots.getCounts()).toEqual({ total: 1, users: 1 });

    for (const orgId of [2, 3, 4]) {
      const joined = orgMember(orgId);
      harness.members = [...harness.members, joined];
      emit(harness, { type: "inserted", next: [joined] });
      await settle();
      expect(harness.slots.getCounts()).toEqual({ total: 1, users: 1 });
    }
    expect(harness.queries.map(({ liveCount }) => liveCount)).toEqual([
      0, 0, 0, 1,
    ]);

    subscription.stop();

    expect(harness.slots.getCounts()).toEqual({ total: 0, users: 0 });
    expect(harness.queries.map(({ liveCount }) => liveCount)).toEqual([
      0, 0, 0, 0,
    ]);
    expect(harness.listeners.size).toBe(0);

    const joined = orgMember(9);
    harness.members = [...harness.members, joined];
    emit(harness, { type: "inserted", next: [joined] });
    await settle();
    expect(harness.queries).toHaveLength(4);
  });

  it("listens once to the memberships for every subscription", async () => {
    const harness = createHarness([orgMember(1)]);
    await harness.open({ accountId: null, bucket: "ready-to-merge" });
    await harness.open({ accountId: null, bucket: "drafts" });

    expect(harness.listeners.size).toBe(1);
  });
});
