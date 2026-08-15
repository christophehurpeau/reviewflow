import { useResource } from "react-liwi";
import type { PrBucket } from "reviewflow-modules";
import type { PrBucketResource } from "#/sections/prs/PrBucketSection.tsx";
import { useReviewflowServices } from "./ReviewflowServicesProvider.tsx";

interface UseMyPrsByBucketOptions {
  /** `null` spans every org the user belongs to */
  orgId: number | null;
  /** the org filter is not resolved yet, querying now would use the wrong scope */
  skip: boolean;
}

/**
 * One query per bucket, so each bucket lives on its own subscription. Buckets
 * are a fixed set, hence the explicit calls rather than a loop.
 */
export const useMyPrsByBucket = ({
  orgId,
  skip,
}: UseMyPrsByBucketOptions): Record<PrBucket, PrBucketResource> => {
  const { prsService } = useReviewflowServices();
  const { queryMyPrs } = prsService.queries;

  const requestedReviews = useResource(
    queryMyPrs,
    { params: { orgId, bucket: "requested-reviews" }, subscribe: true, skip },
    [orgId, skip],
  );
  const readyToMerge = useResource(
    queryMyPrs,
    { params: { orgId, bucket: "ready-to-merge" }, subscribe: true, skip },
    [orgId, skip],
  );
  const changesRequested = useResource(
    queryMyPrs,
    { params: { orgId, bucket: "changes-requested" }, subscribe: true, skip },
    [orgId, skip],
  );
  const waitingForReview = useResource(
    queryMyPrs,
    { params: { orgId, bucket: "waiting-for-review" }, subscribe: true, skip },
    [orgId, skip],
  );
  const noActionPlanned = useResource(
    queryMyPrs,
    { params: { orgId, bucket: "no-action-planned" }, subscribe: true, skip },
    [orgId, skip],
  );
  const drafts = useResource(
    queryMyPrs,
    { params: { orgId, bucket: "drafts" }, subscribe: true, skip },
    [orgId, skip],
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
