import type { Probot } from "probot";
import type { AppContext } from "../../context/AppContext.ts";
import { checkIfIsThisBot } from "../../utils/github/isBotUser.ts";
import { mergeOrEnableGithubAutoMerge } from "./actions/enableGithubAutoMerge.ts";
import { updatePrCommentBodyOptions } from "./actions/updatePrCommentBody.ts";
import { syncLabels } from "./actions/utils/syncLabel.ts";
import { createPullRequestHandler } from "./utils/createPullRequestHandler.ts";

export default function autoMergeChangedHandler(
  app: Probot,
  appContext: AppContext,
): void {
  createPullRequestHandler(
    app,
    appContext,
    "pull_request.auto_merge_enabled",
    (payload, context, repoContext) => {
      if (repoContext.shouldIgnore) return null;

      if (checkIfIsThisBot(payload.sender)) {
        // ignore from this bot
        return null;
      }

      return payload.pull_request;
    },
    async (pullRequest, context, repoContext, reviewflowPrContext) => {
      const autoMergeLabel = repoContext.labels["merge/automerge"];

      await Promise.all([
        // eslint-disable-next-line @typescript-eslint/await-thenable
        reviewflowPrContext &&
          (await updatePrCommentBodyOptions(
            context,
            repoContext,
            reviewflowPrContext,
            {
              autoMerge: true,
            },
          )),
        syncLabels(pullRequest, context, [
          {
            shouldHaveLabel: true,
            label: autoMergeLabel,
          },
        ]),
        reviewflowPrContext &&
          mergeOrEnableGithubAutoMerge(
            pullRequest,
            context,
            repoContext,
            reviewflowPrContext,
            context.payload.sender,
            true,
          ),
      ]);
    },
  );
  createPullRequestHandler(
    app,
    appContext,
    "pull_request.auto_merge_disabled",
    (payload, context, repoContext) => {
      if (repoContext.shouldIgnore) return null;

      if (checkIfIsThisBot(payload.sender)) {
        // ignore from this bot
        return null;
      }

      return payload.pull_request;
    },
    async (pullRequest, context, repoContext, reviewflowPrContext) => {
      const autoMergeLabel = repoContext.labels["merge/automerge"];

      await Promise.all([
        // eslint-disable-next-line @typescript-eslint/await-thenable
        reviewflowPrContext &&
          (await updatePrCommentBodyOptions(
            context,
            repoContext,
            reviewflowPrContext,
            {
              autoMerge: false,
            },
          )),
        syncLabels(pullRequest, context, [
          {
            shouldHaveLabel: false,
            label: autoMergeLabel,
          },
        ]),
      ]);
    },
  );
}
