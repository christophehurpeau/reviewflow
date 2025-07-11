import type { Probot } from "probot";
import type { AppContext } from "../../context/AppContext.ts";
import type { ProbotEvent } from "../probot-types.ts";
import { disableGithubAutoMerge } from "./actions/enableGithubAutoMerge.ts";
import { tryToAutomerge } from "./actions/tryToAutomerge.ts";
import { updateBranch } from "./actions/updateBranch.ts";
import { updatePrCommentBodyOptions } from "./actions/updatePrCommentBody.ts";
import { updateStatusCheckFromStepsState } from "./actions/updateStatusCheckFromStepsState.ts";
import hasLabelInPR from "./actions/utils/labels/hasLabelInPR.ts";
import { calcStepsState } from "./actions/utils/steps/calcStepsState.ts";
import type { PullRequestLabels } from "./utils/PullRequestData.ts";
import { createPullRequestHandler } from "./utils/createPullRequestHandler.ts";
import { fetchPr } from "./utils/fetchPr.ts";

const isFromRenovate = (
  payload: ProbotEvent<
    "pull_request.labeled" | "pull_request.unlabeled"
  >["payload"],
): boolean => {
  const sender = payload.sender;
  return (
    sender.type === "Bot" &&
    sender.login === "renovate[bot]" &&
    payload.pull_request.head.ref.startsWith("renovate/")
  );
};

export default function labelsChanged(
  app: Probot,
  appContext: AppContext,
): void {
  createPullRequestHandler(
    app,
    appContext,
    ["pull_request.labeled", "pull_request.unlabeled"],
    (payload, context, repoContext) => {
      if (payload.sender.type === "Bot" && !isFromRenovate(payload)) {
        return null;
      }

      if (repoContext.shouldIgnore) return null;

      return payload.pull_request;
    },
    async (pullRequest, context, repoContext, reviewflowPrContext) => {
      if (reviewflowPrContext === null) return;

      const fromRenovate = isFromRenovate(context.payload);
      const updatedPr = await fetchPr(context, pullRequest.number);

      const updateBranchLabel = repoContext.labels["merge/update-branch"];
      const autoMergeLabel = repoContext.labels["merge/automerge"];
      const autoMergeSkipCiLabel = repoContext.labels["merge/skip-ci"];
      const bypassProgressLabel = repoContext.labels["merge/bypass-progress"];

      const label = context.payload.label;
      let successful = true;

      if (fromRenovate) {
        const autoApproveLabel = repoContext.labels["review/auto-approve"];

        if (context.payload.action === "labeled") {
          if (autoApproveLabel && label.id === autoApproveLabel.id) {
            await context.octokit.pulls.createReview(
              context.pullRequest({ event: "APPROVE" }),
            );

            let labels: PullRequestLabels = updatedPr.labels;
            const autoMergeWithSkipCi =
              autoMergeSkipCiLabel &&
              repoContext.config.autoMergeRenovateWithSkipCi;
            if (autoMergeWithSkipCi) {
              const result = await context.octokit.issues.addLabels(
                context.repo({
                  issue_number: pullRequest.number,
                  labels: [autoMergeSkipCiLabel.name],
                }),
              );
              labels = result.data;
            }

            const stepsState = calcStepsState({
              pullRequest: updatedPr,
              repoContext,
              reviewflowPrContext,
            });

            await Promise.all([
              updateStatusCheckFromStepsState(
                stepsState,
                updatedPr,
                context,
                repoContext,
                appContext,
                reviewflowPrContext,
                labels,
              ),

              updatePrCommentBodyOptions(
                context,
                repoContext,
                reviewflowPrContext,
                {
                  autoMergeWithSkipCi,
                  // force label to avoid racing events (when both events are sent in the same time, reviewflow treats them one by one but the second event wont have its body updated)
                  autoMerge: hasLabelInPR(labels, autoMergeLabel)
                    ? true
                    : repoContext.config.prDefaultOptions.autoMerge,
                },
              ),
            ]);
            // }
          } else if (autoMergeLabel && label.id === autoMergeLabel.id) {
            await updatePrCommentBodyOptions(
              context,
              repoContext,
              reviewflowPrContext,
              {
                autoMerge: true,
                // force label to avoid racing events (when both events are sent in the same time, reviewflow treats them one by one but the second event wont have its body updated)
                // Note: si c'est renovate qui ajoute le label autoMerge, le label codeApprovedLabel n'aurait pu etre ajouté que par renovate également (on est a quelques secondes de l'ouverture de la pr par renovate)
                autoMergeWithSkipCi: hasLabelInPR(
                  pullRequest.labels,
                  autoMergeSkipCiLabel,
                )
                  ? true
                  : repoContext.config.prDefaultOptions.autoMergeWithSkipCi,
              },
            );

            const stepsState = calcStepsState({
              repoContext,
              pullRequest: updatedPr,
              reviewflowPrContext,
            });

            await updateStatusCheckFromStepsState(
              stepsState,
              updatedPr,
              context,
              repoContext,
              appContext,
              reviewflowPrContext,
            );

            await tryToAutomerge({
              pullRequest: updatedPr,
              repoContext,
              context,
              reviewflowPrContext,
              stepsState,
            });
            return;
          }
        } else if (context.payload.action === "unlabeled") {
        }
        return;
      }

      if (repoContext.protectedLabelIds.includes(label.id)) {
        if (context.payload.action === "labeled") {
          await context.octokit.issues.removeLabel(
            context.repo({
              issue_number: pullRequest.number,
              name: label.name,
            }),
          );
        } else {
          await context.octokit.issues.addLabels(
            context.repo({
              issue_number: pullRequest.number,
              labels: [label.name],
            }),
          );
        }
        return;
      }

      if (bypassProgressLabel && label.id === bypassProgressLabel.id) {
        if (
          context.payload.action === "labeled" &&
          repoContext.config.disableBypassMergeFor?.test(
            repoContext.repoEmbed.name,
          )
        ) {
          await context.octokit.issues.removeLabel(
            context.repo({
              issue_number: pullRequest.number,
              name: label.name,
            }),
          );
        }
      }

      const stepsState = calcStepsState({
        repoContext,
        pullRequest: updatedPr,
        reviewflowPrContext,
      });

      await updateStatusCheckFromStepsState(
        stepsState,
        updatedPr,
        context,
        repoContext,
        appContext,
        reviewflowPrContext,
      );

      // not an else if
      if (autoMergeLabel && label.id === autoMergeLabel.id) {
        if (context.payload.action === "labeled") {
          const { didFailedToEnableAutoMerge } = await tryToAutomerge({
            pullRequest: updatedPr,
            context,
            repoContext,
            reviewflowPrContext,
            stepsState,
          });

          // if not successful, remove label
          if (didFailedToEnableAutoMerge) {
            await context.octokit.issues.removeLabel(
              context.repo({
                issue_number: pullRequest.number,
                name: label.name,
              }),
            );
          }
        } else {
          // eslint-disable-next-line no-lonely-if
          if (repoContext.settings.allowAutoMerge) {
            successful = await disableGithubAutoMerge(
              pullRequest,
              context,
              repoContext,
              reviewflowPrContext,
              context.payload.sender.login,
            );
            // if not successful, add label back
            if (!successful) {
              await context.octokit.issues.addLabels(
                context.repo({
                  issue_number: pullRequest.number,
                  labels: [label.name],
                }),
              );
            }
          }
        }
      }

      if (updateBranchLabel && label.id === updateBranchLabel.id) {
        if (context.payload.action === "labeled") {
          await updateBranch(updatedPr, context, context.payload.sender.login);
          await context.octokit.issues.removeLabel(
            context.repo({
              issue_number: pullRequest.number,
              name: label.name,
            }),
          );
        }
      }

      if (successful) {
        const option = (() => {
          if (autoMergeLabel && label.id === autoMergeLabel.id) {
            return "autoMerge";
          }
          if (autoMergeSkipCiLabel && label.id === autoMergeSkipCiLabel.id) {
            return "autoMergeWithSkipCi";
          }
          return null;
        })();

        if (option) {
          await updatePrCommentBodyOptions(
            context,
            repoContext,
            reviewflowPrContext,
            {
              [option]: context.payload.action === "labeled",
            },
          );
        }
      }
    },
  );
}
