import { Application } from 'probot';
import { handlerPullRequestChange } from './utils';
import { autoMergeIfPossible } from './actions/autoMergeIfPossible';
import { updateStatusCheckFromLabels } from './actions/updateStatusCheckFromLabels';
import { autoApproveAndAutoMerge } from './actions/autoApproveAndAutoMerge';

export default function labelsChanged(app: Application): void {
  app.on(
    ['pull_request.labeled', 'pull_request.unlabeled'],
    async (context) => {
      const sender = context.payload.sender;
      const fromRenovate =
        sender.type === 'Bot' &&
        context.payload.pull_request.head.ref.startsWith('renovate/');

      if (sender.type === 'Bot' && !fromRenovate) {
        return;
      }

      await handlerPullRequestChange(context, async (repoContext) => {
        if (fromRenovate) {
          return autoApproveAndAutoMerge(context, repoContext);
        }

        const label = context.payload.label;
        if (repoContext.protectedLabelIds.includes(label.id)) {
          if (context.payload.action === 'labeled') {
            await context.github.issues.removeLabel(
              context.issue({ name: label.name }),
            );
          } else {
            await context.github.issues.addLabels(
              context.issue({ labels: [label.name] }),
            );
          }
          return;
        }

        await updateStatusCheckFromLabels(context, repoContext);

        if (context.payload.action === 'labeled') {
          if (
            repoContext.labels['merge/automerge'] &&
            label.id === repoContext.labels['merge/automerge'].id
          ) {
            await autoMergeIfPossible(context, repoContext);
          }

          // if (
          //   repoContext.labels['feature-branch'] &&
          //   label.id === repoContext.labels['feature-branch'].id
          // ) {
          // }
        }
      });
    },
  );
}
