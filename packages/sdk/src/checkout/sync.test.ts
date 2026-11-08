import { describe, expect, it } from "vitest";
import type { CheckoutStatus } from "./sync.ts";
import { pullRefusal, pushRefusal } from "./sync.ts";

const status = (over: Partial<CheckoutStatus>): CheckoutStatus => ({
  path: "/repo",
  branch: "main",
  commit: null,
  upstream: "origin/main",
  ahead: 0,
  behind: 0,
  modified: 0,
  untracked: 0,
  ...over,
});

describe("pullRefusal", () => {
  it("offers a pull only when the branch is behind its upstream", () => {
    expect(pullRefusal(status({ behind: 2 }))).toBeNull();
    expect(pullRefusal(status({ behind: 2, ahead: 1 }))).toBeNull();
    expect(pullRefusal(status({ behind: 0 }))).toBe(
      "main is not behind origin/main",
    );
  });

  it("refuses a detached HEAD and a branch with no upstream", () => {
    expect(pullRefusal(status({ branch: null, behind: 1 }))).toBe(
      "a detached HEAD has nothing to pull into",
    );
    expect(
      pullRefusal(status({ upstream: null, ahead: null, behind: null })),
    ).toBe("main tracks no remote branch");
  });
});

describe("pushRefusal", () => {
  it("offers a push when the branch is ahead of its upstream", () => {
    expect(pushRefusal(status({ ahead: 1 }), true)).toBeNull();
    expect(pushRefusal(status({ ahead: 0 }), true)).toBe(
      "main has nothing to push to origin/main",
    );
  });

  it("publishes a branch with no upstream only when origin exists", () => {
    const unpublished = status({ upstream: null, ahead: null, behind: null });
    expect(pushRefusal(unpublished, true)).toBeNull();
    expect(pushRefusal(unpublished, false)).toBe(
      "this repository has no origin remote",
    );
  });

  it("refuses a detached HEAD", () => {
    expect(pushRefusal(status({ branch: null, ahead: 1 }), true)).toBe(
      "a detached HEAD has no branch to push",
    );
  });

  it("never publishes again a branch whose upstream was deleted", () => {
    const gone = status({ ahead: null, behind: null });
    expect(pushRefusal(gone, true)).toBe(
      "origin/main no longer exists on the remote",
    );
    expect(pullRefusal(gone)).toBe(
      "origin/main no longer exists on the remote",
    );
  });
});
