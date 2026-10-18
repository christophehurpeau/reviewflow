import { describe, expect, it, vi } from "vitest";
import type { MongoStores, OrgMember } from "reviewflow-core";
import type { AuthenticatedWsUser } from "./getAuthenticatedUser.ts";
import { createMembershipScopes } from "./membershipScopes.ts";

type Listener = Parameters<MongoStores["orgMembers"]["subscribe"]>[0];

const createFakeOrgMembers = () => {
  const listeners = new Set<Listener>();
  return {
    listeners,
    subscribe: (listener: Listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    emit: (action: Parameters<Listener>[0]) => {
      listeners.forEach((listener) => listener(action));
    },
  };
};

const user = (id: number): AuthenticatedWsUser => ({
  id,
  login: `user-${id}`,
  accessToken: "token",
});

const orgMember = (orgId: number, userId: number): OrgMember => ({
  _id: `${orgId}_${userId}`,
  org: { id: orgId, login: `org-${orgId}` },
  user: { id: userId, login: `user-${userId}` },
  teams: [],
  created: new Date(),
  updated: new Date(),
});

describe("createMembershipScopes", () => {
  it("listens to the org members only while something watches", () => {
    const orgMembers = createFakeOrgMembers();
    const scopes = createMembershipScopes(orgMembers);
    expect(orgMembers.listeners.size).toBe(0);

    const unwatchFirst = scopes.watch(user(1), vi.fn());
    const unwatchSecond = scopes.watch(user(2), vi.fn());
    expect(orgMembers.listeners.size).toBe(1);

    unwatchFirst();
    expect(orgMembers.listeners.size).toBe(1);
    unwatchSecond();
    expect(orgMembers.listeners.size).toBe(0);
  });

  it.each<[string, Parameters<Listener>[0]]>([
    ["inserted", { type: "inserted", next: [orgMember(1, 1)] }],
    ["deleted", { type: "deleted", prev: [orgMember(1, 1)] }],
    [
      "updated",
      {
        type: "updated",
        changes: [[orgMember(1, 1), orgMember(1, 1)]],
      },
    ],
    ["changed, by its key alone", { type: "changed", keys: ["1_1"], next: [] }],
    [
      "changed, by its document",
      { type: "changed", keys: [], next: [orgMember(1, 1)] },
    ],
  ])("notifies the watchers of the user on %s", (_name, action) => {
    const orgMembers = createFakeOrgMembers();
    const scopes = createMembershipScopes(orgMembers);
    const concerned = vi.fn();
    const other = vi.fn();
    scopes.watch(user(1), concerned);
    scopes.watch(user(2), other);

    orgMembers.emit(action);

    expect(concerned).toHaveBeenCalledTimes(1);
    expect(other).not.toHaveBeenCalled();
  });

  it("notifies everyone on a resync", () => {
    const orgMembers = createFakeOrgMembers();
    const scopes = createMembershipScopes(orgMembers);
    const first = vi.fn();
    const second = vi.fn();
    scopes.watch(user(1), first);
    scopes.watch(user(2), second);

    orgMembers.emit({ type: "resync" });

    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(1);
  });

  it("no longer notifies a watcher once it stopped", () => {
    const orgMembers = createFakeOrgMembers();
    const scopes = createMembershipScopes(orgMembers);
    const onChange = vi.fn();
    const unwatch = scopes.watch(user(1), onChange);
    scopes.watch(user(2), vi.fn());
    unwatch();

    orgMembers.emit({ type: "inserted", next: [orgMember(1, 1)] });

    expect(onChange).not.toHaveBeenCalled();
  });
});
