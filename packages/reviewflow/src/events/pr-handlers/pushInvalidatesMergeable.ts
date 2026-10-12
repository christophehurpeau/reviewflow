import type { Probot } from "probot";
import type { MongoStores } from "reviewflow-core";
import type { AppContext } from "../../context/AppContext.ts";
import { obtainRepoContext } from "../../context/repoContext.ts";
import { scheduleMergeableRefresh } from "./utils/refreshMergeable.ts";

const branchRefPrefix = "refs/heads/";

interface PushedBranch {
  accountId: number;
  repositoryId: number;
  ref: string;
}

const getPushedBranchName = (ref: string): string | undefined =>
  ref.startsWith(branchRefPrefix)
    ? ref.slice(branchRefPrefix.length)
    : undefined;

/**
 * github sends no event when a pull request starts conflicting because its
 * base moved: a stored `mergeable` would silently turn wrong. Back to
 * `unknown` instead, until it is read again.
 */
export const invalidateMergeableOnBasePush = async (
  mongoStores: MongoStores,
  { accountId, repositoryId, ref }: PushedBranch,
): Promise<void> => {
  const baseRef = getPushedBranchName(ref);
  if (!baseRef) return;

  await mongoStores.prs.partialUpdateMany(
    {
      "account.id": accountId,
      "repo.id": repositoryId,
      baseRef,
      isClosed: false,
      mergeable: { $in: ["conflicting", "mergeable"] },
    },
    { $set: { mergeable: "unknown" } },
  );
};

/** every push to a pull request's head branch is a `push` too: only a base with open pull requests is worth a read */
export const hasOpenPullRequestsOnBase = async (
  mongoStores: MongoStores,
  { accountId, repositoryId, ref }: PushedBranch,
): Promise<boolean> => {
  const baseRef = getPushedBranchName(ref);
  if (!baseRef) return false;

  const pr = await mongoStores.prs.findOne({
    "account.id": accountId,
    "repo.id": repositoryId,
    baseRef,
    isClosed: false,
  });
  return !!pr;
};

export default function pushInvalidatesMergeable(
  app: Probot,
  appContext: AppContext,
): void {
  app.on("push", async (context) => {
    const { payload } = context;
    const owner = payload.repository.owner;
    const baseRef = getPushedBranchName(payload.ref);
    if (!owner || !baseRef) return;

    const pushedBranch: PushedBranch = {
      accountId: owner.id,
      repositoryId: payload.repository.id,
      ref: payload.ref,
    };

    await invalidateMergeableOnBasePush(appContext.mongoStores, pushedBranch);

    if (
      !(await hasOpenPullRequestsOnBase(appContext.mongoStores, pushedBranch))
    ) {
      return;
    }

    const repoContext = await obtainRepoContext(appContext, context);
    if (repoContext.shouldIgnore) return;

    scheduleMergeableRefresh({ context, appContext, repoContext }, { baseRef });
  });
}
