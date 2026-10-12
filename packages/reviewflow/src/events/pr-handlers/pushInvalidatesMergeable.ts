import type { Probot } from "probot";
import type { MongoStores } from "reviewflow-core";
import type { AppContext } from "../../context/AppContext.ts";

const branchRefPrefix = "refs/heads/";

interface PushedBranch {
  accountId: number;
  repositoryId: number;
  ref: string;
}

/**
 * github sends no event when a pull request starts conflicting because its
 * base moved: a stored `mergeable` would silently turn wrong. Back to
 * `unknown` instead, until the next `pull_request` payload says.
 */
export const invalidateMergeableOnBasePush = async (
  mongoStores: MongoStores,
  { accountId, repositoryId, ref }: PushedBranch,
): Promise<void> => {
  if (!ref.startsWith(branchRefPrefix)) return;

  await mongoStores.prs.partialUpdateMany(
    {
      "account.id": accountId,
      "repo.id": repositoryId,
      baseRef: ref.slice(branchRefPrefix.length),
      isClosed: false,
      mergeable: { $in: ["conflicting", "mergeable"] },
    },
    { $set: { mergeable: "unknown" } },
  );
};

export default function pushInvalidatesMergeable(
  app: Probot,
  { mongoStores }: AppContext,
): void {
  app.on("push", async ({ payload }) => {
    const owner = payload.repository.owner;
    if (!owner) return;

    await invalidateMergeableOnBasePush(mongoStores, {
      accountId: owner.id,
      repositoryId: payload.repository.id,
      ref: payload.ref,
    });
  });
}
