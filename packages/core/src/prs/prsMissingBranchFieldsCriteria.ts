import type { Criteria } from "liwi-store";
import type { ReviewflowPr } from "../mongo.ts";

/**
 * The documents the branch backfill still has to write: any of the branch
 * fields absent, or closed without `isMerged`. Once written they stop matching,
 * which is what makes the backfill resumable.
 */
export const prsMissingBranchFieldsCriteria = (
  repositoryId: number,
): Criteria<ReviewflowPr> => ({
  "repo.id": repositoryId,
  $or: [
    { headRef: { $exists: false } },
    { baseRef: { $exists: false } },
    { headRepoFullName: { $exists: false } },
    { isClosed: true, isMerged: { $exists: false } },
  ],
});
