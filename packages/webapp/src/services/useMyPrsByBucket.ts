import { useResource } from "react-liwi";
import type { PrBucket } from "reviewflow-modules";
import type { PrBucketResource } from "#/sections/prs/PrBucketSection.tsx";
import { useReviewflowServices } from "./ReviewflowServicesProvider.tsx";

interface UseMyPrsByBucketOptions {
  /** `null` spans the user's own account and every org they belong to */
  accountId: number | null;
  /** the account filter is not resolved yet, querying now would use the wrong scope */
  skip: boolean;
}

/**
 * One query per bucket, so each bucket lives on its own subscription. Buckets
 * are a fixed set, hence the explicit calls rather than a loop.
 */
export const useMyPrsByBucket = ({
  accountId,
  skip,
}: UseMyPrsByBucketOptions): Record<PrBucket, PrBucketResource> => {
  const { prsService } = useReviewflowServices();
  const { queryMyPrs } = prsService.queries;

  const requestedReviews = useResource(
    queryMyPrs,
    {
      params: { accountId, bucket: "requested-reviews" },
      subscribe: true,
      skip,
    },
    [accountId, skip],
  );
  const readyToMerge = useResource(
    queryMyPrs,
    { params: { accountId, bucket: "ready-to-merge" }, subscribe: true, skip },
    [accountId, skip],
  );
  const changesRequested = useResource(
    queryMyPrs,
    {
      params: { accountId, bucket: "changes-requested" },
      subscribe: true,
      skip,
    },
    [accountId, skip],
  );
  const waitingForReview = useResource(
    queryMyPrs,
    {
      params: { accountId, bucket: "waiting-for-review" },
      subscribe: true,
      skip,
    },
    [accountId, skip],
  );
  const noActionPlanned = useResource(
    queryMyPrs,
    {
      params: { accountId, bucket: "no-action-planned" },
      subscribe: true,
      skip,
    },
    [accountId, skip],
  );
  const drafts = useResource(
    queryMyPrs,
    { params: { accountId, bucket: "drafts" }, subscribe: true, skip },
    [accountId, skip],
  );

  return {
    "requested-reviews": requestedReviews,
    "ready-to-merge": readyToMerge,
    "changes-requested": changesRequested,
    "waiting-for-review": waitingForReview,
    "no-action-planned": noActionPlanned,
    drafts,
  };
};
