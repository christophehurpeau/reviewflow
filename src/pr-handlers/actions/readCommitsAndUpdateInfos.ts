import Webhooks from '@octokit/webhooks';
import parse from '@commitlint/parse';
import { PRHandler } from '../utils';
import { contextPr } from '../../context/utils';
import syncLabel from './utils/syncLabel';
import { updateBodyCommitsNotes } from './utils/updateBody';
import { updatePrIfNeeded } from './updatePr';

export const readCommitsAndUpdateInfos: PRHandler<
  Webhooks.WebhookPayloadPullRequest
> = async (pr, context, repoContext) => {
  // tmp.data[0].sha
  // tmp.data[0].commit.message

  const commits = await context.github.paginate(
    context.github.pulls.listCommits(
      contextPr(context, {
        // A custom page size up to 100. Default is 30.
        per_page: 100,
      }),
    ),
    (res) => res.data,
  );

  const conventionalCommits = await Promise.all(
    commits.map((c) => parse(c.commit.message)),
  );

  const breakingChangesCommits: any = conventionalCommits.reduce(
    (acc, c, index) => {
      const breakingChangesNotes = c.notes.filter(
        (note: any) => note.title === 'BREAKING CHANGE',
      );
      if (breakingChangesNotes.length !== 0) {
        acc.push({ commit: commits[index], breakingChangesNotes });
      }

      return acc;
    },
    [],
  );

  const breakingChangesLabel = repoContext.labels['breaking-changes'];
  const newBody = updateBodyCommitsNotes(
    pr.body,
    breakingChangesCommits.length === 0
      ? ''
      : `Breaking Changes:\n${breakingChangesCommits
          .map(({ commit, breakingChangesNotes }: any) =>
            breakingChangesNotes.map(
              (note: any) =>
                `- ${note.text.replace('\n', ' ')} (${commit.sha})`,
            ),
          )
          .join('')}`,
  );

  await Promise.all([
    syncLabel(
      pr,
      context,
      breakingChangesCommits.length !== 0,
      breakingChangesLabel,
    ),
    updatePrIfNeeded(pr, context, repoContext, { body: newBody }),
  ]);

  // TODO auto update ! in front of : to signal a breaking change when https://github.com/conventional-changelog/commitlint/issues/658 is closed
};
