import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  parseStatusV2,
  pullCheckout,
  pushCheckout,
  readCheckoutStatus,
  readCheckoutSync,
} from "./checkoutSync.ts";
import type { BareRemoteFixture, GitRepoFixture } from "./test/gitRepo.ts";
import { createBareRemote, createGitRepo } from "./test/gitRepo.ts";

let repo: GitRepoFixture | undefined;
let remote: BareRemoteFixture | undefined;

afterEach(() => {
  repo?.remove();
  remote?.remove();
  repo = undefined;
  remote = undefined;
});

/** A clone tracking `main` on a local bare remote: nothing reaches the network. */
const createTrackingClone = (): {
  repo: GitRepoFixture;
  remote: BareRemoteFixture;
} => {
  const bare = createBareRemote();
  const clone = createGitRepo({ remote: bare.path });
  clone.git(["push", "--quiet", "-u", "origin", "main"]);
  return { repo: clone, remote: bare };
};

describe("parseStatusV2", () => {
  it("reads the branch, its upstream and how far apart they are", () => {
    expect(
      parseStatusV2(
        [
          "# branch.oid 1111111111111111111111111111111111111111",
          "# branch.head feat/board",
          "# branch.upstream origin/feat/board",
          "# branch.ab +2 -3",
          "1 .M N... 100644 100644 100644 aaa bbb src/a.ts",
          "2 R. N... 100644 100644 100644 aaa bbb R100 src/b.ts\tsrc/c.ts",
          "u UU N... 100644 100644 100644 100644 aaa bbb ccc src/d.ts",
          "? notes.md",
          "? scratch/",
          "",
        ].join("\n"),
      ),
    ).toStrictEqual({
      branch: "feat/board",
      hasCommit: true,
      upstream: "origin/feat/board",
      ahead: 2,
      behind: 3,
      modified: 3,
      untracked: 2,
    });
  });

  it("reports a detached HEAD as no branch and no upstream", () => {
    expect(
      parseStatusV2("# branch.oid 1111111\n# branch.head (detached)\n"),
    ).toMatchObject({ branch: null, upstream: null, ahead: null });
  });

  it("reports a branch with no commit yet", () => {
    expect(
      parseStatusV2("# branch.oid (initial)\n# branch.head main\n"),
    ).toMatchObject({ branch: "main", hasCommit: false });
  });

  /** git drops `branch.ab` when the upstream's ref was pruned. */
  it("leaves ahead and behind unknown when the upstream ref is gone", () => {
    expect(
      parseStatusV2(
        "# branch.oid 1111111\n# branch.head feat/merged\n# branch.upstream origin/feat/merged\n",
      ),
    ).toMatchObject({
      upstream: "origin/feat/merged",
      ahead: null,
      behind: null,
    });
  });
});

/** Real git, so the porcelain v2 assumptions above are checked against it. */
describe("readCheckoutStatus", () => {
  it("counts what the remote has that the checkout does not", async () => {
    ({ repo, remote } = createTrackingClone());
    remote.pushFromElsewhere("main");
    repo.git(["fetch", "--quiet"]);
    repo.commit(undefined, "2026-08-20T10:00:00Z");
    writeFileSync(join(repo.path, "untracked.txt"), "");

    expect(await readCheckoutStatus(repo.path)).toStrictEqual({
      path: repo.path,
      branch: "main",
      commit: {
        shortSha: expect.any(String),
        subject: "chore: commit",
        committedAt: "2026-08-20T10:00:00.000Z",
      },
      upstream: "origin/main",
      ahead: 1,
      behind: 1,
      modified: 0,
      untracked: 1,
    });
  });

  it("has no commit and no upstream on a fresh repository", async () => {
    repo = createGitRepo({ initialCommit: false });
    expect(await readCheckoutStatus(repo.path)).toMatchObject({
      branch: "main",
      commit: null,
      upstream: null,
    });
  });
});

describe("readCheckoutSync", () => {
  it("counts behind only after a fetch", async () => {
    ({ repo, remote } = createTrackingClone());
    remote.pushFromElsewhere("main");

    const unfetched = await readCheckoutSync({ cwd: repo.path });
    expect(unfetched.status.behind).toBe(0);
    expect(unfetched.hasOrigin).toBe(true);

    const fetched = await readCheckoutSync({ cwd: repo.path, fetch: "always" });
    expect(fetched).toMatchObject({ fetchError: null, status: { behind: 1 } });
  });

  it("skips the fetch while the upstream is at the expected head", async () => {
    ({ repo, remote } = createTrackingClone());
    const head = repo.git(["rev-parse", "HEAD"]).trim();
    remote.pushFromElsewhere("main");

    const read = await readCheckoutSync({
      cwd: repo.path,
      fetch: { unlessUpstreamAt: head },
    });
    expect(read.status.behind).toBe(0);
  });
});

describe("pullCheckout and pushCheckout", () => {
  it("pulls what the remote has, then pushes a new commit", async () => {
    ({ repo, remote } = createTrackingClone());
    remote.pushFromElsewhere("main");
    repo.git(["fetch", "--quiet"]);

    await pullCheckout(repo.path);
    expect(await readCheckoutStatus(repo.path)).toMatchObject({
      ahead: 0,
      behind: 0,
    });

    repo.commit();
    await pushCheckout(repo.path);
    expect(await readCheckoutStatus(repo.path)).toMatchObject({
      ahead: 0,
      behind: 0,
    });
  });

  it("publishes a branch with no upstream and starts tracking it", async () => {
    ({ repo, remote } = createTrackingClone());
    repo.git(["switch", "--quiet", "-c", "feature"]);
    repo.commit();

    await pushCheckout(repo.path);
    expect(await readCheckoutStatus(repo.path)).toMatchObject({
      branch: "feature",
      upstream: "origin/feature",
      ahead: 0,
    });
  });

  it("throws the refusal before running git", async () => {
    ({ repo, remote } = createTrackingClone());
    await expect(pullCheckout(repo.path)).rejects.toThrow(
      "main is not behind origin/main",
    );
    await expect(pushCheckout(repo.path)).rejects.toThrow(
      "main has nothing to push to origin/main",
    );
  });
});
