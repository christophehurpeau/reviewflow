import type { EmitterWebhookEventName } from "@octokit/webhooks";
import type { ReviewflowPr } from "reviewflow-core";
import { recordPrActivity, toPrActivityTarget } from "reviewflow-core";
import type { AppContext } from "../../../context/AppContext.ts";
import type { ProbotEvent } from "../../probot-types";
import type { PullRequestWithDecentData } from "../utils/PullRequestData";

interface UpdatePr {
  title?: string;
  body?: string;
}

interface UpdatePrIfNeededOptions<Name extends EmitterWebhookEventName> {
  appContext: AppContext;
  pullRequest: PullRequestWithDecentData;
  context: ProbotEvent<Name>;
  reviewflowPr: ReviewflowPr;
  update: UpdatePr;
}

const cleanNewLines = (text: string | null): string =>
  !text ? "" : text.replace(/\r\n/g, "\n");
const checkIfHasDiff = (text1: string | null, text2: string): boolean =>
  cleanNewLines(text1) !== cleanNewLines(text2);

export const updatePrIfNeeded = async <Name extends EmitterWebhookEventName>({
  appContext,
  pullRequest,
  context,
  reviewflowPr,
  update,
}: UpdatePrIfNeededOptions<Name>): Promise<void> => {
  const hasDiffInTitle = update.title && pullRequest.title !== update.title;
  const hasDiffInBody =
    update.body && checkIfHasDiff(pullRequest.body, update.body);

  if (hasDiffInTitle || hasDiffInBody) {
    const diff: Partial<Record<"body" | "title", string>> = {};
    if (hasDiffInTitle) {
      diff.title = update.title;
      pullRequest.title = update.title!;
    }
    if (hasDiffInBody) {
      diff.body = update.body;
      pullRequest.body = update.body!;
    }

    const { data: updatedPullRequest } =
      await context.octokit.rest.pulls.update(
        context.repo({
          pull_number: pullRequest.number,
          ...diff,
        }),
      );

    if (hasDiffInBody) {
      await recordPrActivity(appContext.mongoStores, {
        ...toPrActivityTarget(reviewflowPr),
        flowDate: "lastBodyEditedAt",
        at: new Date(updatedPullRequest.updated_at),
      });
    }
  }
};
