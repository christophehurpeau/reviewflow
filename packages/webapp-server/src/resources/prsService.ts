import { ResourcesServerError } from "liwi-resources-server";
import type { ServiceResource } from "liwi-resources-server";
import {
  buildPrBucketQuery,
  buildPullRequestUrl,
  reviewedWithReviewer,
  reviewsAfterRequestingAgain,
  toPrSummary,
} from "reviewflow-core";
import type { PrsService } from "reviewflow-modules";
import type { ResourcesContext } from "../ResourcesContext.ts";
import {
  createReviewAsUser,
  requestOwnReviewAgain,
} from "../github/reviewAsUser.ts";
import type { AuthenticatedWsUser } from "./getAuthenticatedUser.ts";
import { requireAccount, requireAccounts } from "./requireAuth.ts";

export const createPrsService = ({
  mongoStores,
}: ResourcesContext): ServiceResource<PrsService, AuthenticatedWsUser> => ({
  queries: {
    queryMyPrs: async ({ accountId, bucket }, loggedInUser) => {
      const { user, accounts } = await requireAccounts(
        mongoStores,
        accountId,
        loggedInUser,
      );

      const { criteria, sort } = buildPrBucketQuery(bucket, {
        userId: user.id,
        accounts,
      });

      return mongoStores.prs.createQueryCollection({
        criteria,
        sort,
        limit: 100,
        transformer: toPrSummary,
      });
    },
  },
  operations: {
    startReview: async ({ prId }, loggedInUser) => {
      const pr = await mongoStores.prs.findByKey(prId);
      if (!pr) {
        throw new ResourcesServerError("NOT_FOUND", "Unknown pull request");
      }

      // the client only sends a pr id, the document supplies the account the
      // membership is proved against
      const { user } = await requireAccount(
        mongoStores,
        pr.account.id,
        loggedInUser,
      );

      const prUrl = buildPullRequestUrl(pr);
      const reviewer = { id: user.id, login: user.login };

      // asked for a review they have already been through: the pull request
      // already sits in the re-requested reviews, which is where starting it
      // would put it, so there is nothing to start. Pressing twice in a row
      // lands here too, on the write the first press made just below
      const isAskedAgain =
        (pr.reviews?.reviewed?.some(({ id }) => id === user.id) ?? false) &&
        (pr.reviews?.reviewRequested?.some(({ id }) => id === user.id) ??
          false);
      if (isAskedAgain) return { prUrl };

      if (pr.isClosed) {
        throw new ResourcesServerError(
          "BAD_REQUEST",
          "This pull request is closed",
        );
      }

      // github, called with the user's own token, is the authority on whether
      // they may review this pull request at all: it answers before mongo is
      // touched, and a repository they cannot read answers 404
      await createReviewAsUser(user.accessToken, pr);

      // the comment retires the request the reviewer was answering, their own
      // and their teams' alike, and leaves any approval they had standing.
      // Asking again is what puts the review back on them by name and takes
      // that approval out of the count
      const requestedAgain = await requestOwnReviewAgain(
        user.accessToken,
        pr,
        user.login,
      );

      await mongoStores.prs.partialUpdateOne(
        pr,
        requestedAgain
          ? {
              $set: {
                reviews: reviewsAfterRequestingAgain(pr.reviews, reviewer),
              },
            }
          : // github would not ask again, so only the review itself happened:
            // recording no more than that leaves the next webhook to reconcile
            {
              $set: {
                "reviews.reviewed": reviewedWithReviewer(
                  pr.reviews?.reviewed,
                  reviewer,
                ),
              },
            },
      );

      return { prUrl };
    },
  },
});
