import parse from '@commitlint/parse';
import type { CommitNote } from '@commitlint/types';
import type { RestEndpointMethodTypes } from '@octokit/rest';
import type { EventPayloads } from '@octokit/webhooks';
import type { Context } from 'probot';
import type { RepoContext } from 'context/repoContext';
import type { PullRequestWithDecentData } from '../utils/PullRequestData';
import type { ReviewflowPrContext } from '../utils/createPullRequestContext';
import { updatePrCommentBodyIfNeeded } from './updatePrCommentBody';
import { updateCommentBodyCommitsNotes } from './utils/body/updateBody';
import syncLabel from './utils/syncLabel';

interface BreakingChangesCommits {
  commit: RestEndpointMethodTypes['pulls']['listCommits']['response']['data'][number];
  breakingChangesNotes: CommitNote[];
}

export const readCommitsAndUpdateInfos = async <
  E extends EventPayloads.WebhookPayloadPullRequest
>(
  pullRequest: PullRequestWithDecentData,
  context: Context<E>,
  repoContext: RepoContext,
  reviewflowPrContext: ReviewflowPrContext,
  commentBody = reviewflowPrContext.commentBody,
): Promise<void> => {
  // tmp.data[0].sha
  // tmp.data[0].commit.message

  const commits = await context.octokit.paginate(
    context.octokit.pulls.listCommits,
    context.pullRequest({
      // A custom page size up to 100. Default is 30.
      per_page: 100,
    }),
    (res) => res.data,
  );

  const conventionalCommits = await Promise.all(
    commits.map((c) => parse(c.commit.message)),
  );

  const breakingChangesCommits: BreakingChangesCommits[] = [];
  conventionalCommits.forEach((c, index) => {
    const breakingChangesNotes = c.notes.filter(
      (note) => note.title === 'BREAKING CHANGE',
    );
    if (breakingChangesNotes.length > 0) {
      breakingChangesCommits.push({
        commit: commits[index],
        breakingChangesNotes,
      });
    }
  });

  const breakingChangesLabel = repoContext.labels['breaking-changes'];
  const newCommentBody = updateCommentBodyCommitsNotes(
    commentBody,
    breakingChangesCommits.length === 0
      ? ''
      : `Breaking Changes:\n${breakingChangesCommits
          .map(({ commit, breakingChangesNotes }) =>
            breakingChangesNotes.map(
              (note) => `- ${note.text.replace('\n', ' ')} (${commit.sha})`,
            ),
          )
          .join('')}`,
  );

  await Promise.all([
    syncLabel(
      pullRequest,
      context,
      breakingChangesCommits.length !== 0,
      breakingChangesLabel,
    ),
    updatePrCommentBodyIfNeeded(context, reviewflowPrContext, newCommentBody),
  ]);

  // TODO auto update ! in front of : to signal a breaking change when https://github.com/conventional-changelog/commitlint/issues/658 is closed
};
