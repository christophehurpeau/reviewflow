import { setTimeout as delay } from "node:timers/promises";
import { Octokit } from "@octokit/rest";
import { ResourcesServerError } from "liwi-resources-server";
import type { ReviewflowPr } from "reviewflow-core";

export const startReviewBody = "I started the review";

const createApi = (accessToken: string): Octokit =>
  new Octokit({ auth: accessToken });

const prTarget = (pr: ReviewflowPr) => ({
  owner: pr.account.login,
  repo: pr.repo.name,
  pull_number: pr.pr.number,
});

interface GithubErrorShape {
  status: number;
  response?: { data?: { message?: string } };
}

const isGithubError = (error: unknown): error is GithubErrorShape =>
  typeof error === "object" &&
  error !== null &&
  typeof (error as { status?: unknown }).status === "number";

/**
 * Github's own message is the only place the real reason lives for 403 and 422 —
 * saml enforcement, a secondary rate limit, reviewing your own pull request —
 * so it is forwarded rather than replaced.
 */
const toResourcesServerError = ({
  status,
  response,
}: GithubErrorShape): ResourcesServerError => {
  const githubMessage = response?.data?.message;

  switch (status) {
    case 401:
      return new ResourcesServerError(
        "UNAUTHENTICATED",
        "Your github authorization expired, sign in again",
      );
    case 403:
      return new ResourcesServerError(
        "FORBIDDEN",
        githubMessage || "Github refused the review",
      );
    case 404:
      return new ResourcesServerError(
        "NOT_FOUND",
        "This pull request is not visible with your github account",
      );
    case 422:
      return new ResourcesServerError(
        "BAD_REQUEST",
        githubMessage || "Github could not accept the review",
      );
    default:
      return new ResourcesServerError(
        "UNEXPECTED_ERROR",
        "Could not submit the review on github",
      );
  }
};

/**
 * Submits the review as the logged in user, never as the reviewflow app: this is
 * what makes github stop listing them as awaiting a requested review, and what
 * attributes the comment to the person who pressed the button.
 *
 * The octokit error carries the user's token in `request.headers.authorization`,
 * so it is never rethrown nor logged as is.
 */
export const createReviewAsUser = async (
  accessToken: string,
  pr: ReviewflowPr,
): Promise<void> => {
  try {
    await createApi(accessToken).pulls.createReview({
      ...prTarget(pr),
      event: "COMMENT",
      body: startReviewBody,
    });
  } catch (error) {
    if (!isGithubError(error)) throw error;

    console.error("Could not start the review on github", {
      status: error.status,
      message: error.response?.data?.message,
      prId: pr._id,
    });

    throw toResourcesServerError(error);
  }
};

/**
 * Github retires the pending review request as a side effect of the review
 * submission, not as part of answering it: asking again in the same breath is
 * undone by that side effect landing afterwards, so it is given time to.
 */
const retireRequestSettleMs = 100;

/**
 * A comment review leaves a standing approval standing: github keeps the last
 * decision a reviewer made, so a pull request they had approved stays approved
 * while they are reviewing it again. Asking for their review again is what puts
 * that approval back in play.
 *
 * Best effort on purpose: it needs push access on the repository, which a
 * reviewer does not necessarily have, and the review comment — the thing the
 * reviewer asked for — has already been posted by the time this runs. It
 * reports whether github accepted, so nothing claims an approval was cleared
 * when it was not.
 */
export const requestOwnReviewAgain = async (
  accessToken: string,
  pr: ReviewflowPr,
  login: string,
): Promise<boolean> => {
  await delay(retireRequestSettleMs);

  try {
    await createApi(accessToken).pulls.requestReviewers({
      ...prTarget(pr),
      reviewers: [login],
    });
    return true;
  } catch (error) {
    console.error("Could not request the review again on github", {
      status: isGithubError(error) ? error.status : undefined,
      message: isGithubError(error) ? error.response?.data?.message : undefined,
      prId: pr._id,
      login,
    });
    return false;
  }
};
