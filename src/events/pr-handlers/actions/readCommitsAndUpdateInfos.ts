import type { CommitNote } from '@commitlint/types';
import type { RestEndpointMethodTypes } from '@octokit/rest';
import type {
  EventsWithRepository,
  RepoContext,
} from '../../../context/repoContext';
import type { ProbotEvent } from '../../probot-types';
import type { PullRequestWithDecentData } from '../utils/PullRequestData';
import type { ReviewflowPrContext } from '../utils/createPullRequestContext';
import { updatePrIfNeeded } from './updatePr';
import { updatePrCommentBodyIfNeeded } from './updatePrCommentBody';
import { updateCommentBodyCommitsNotes } from './utils/body/updateBody';
import { parseCommitMessage } from './utils/commitMessages';
import { readPullRequestCommits } from './utils/readPullRequestCommits';
import syncLabel from './utils/syncLabel';

interface BreakingChangesCommits {
  commit: RestEndpointMethodTypes['pulls']['listCommits']['response']['data'][number];
  breakingChangesNotes: CommitNote[];
}

export const readCommitsAndUpdateInfos = async <
  Name extends EventsWithRepository,
>(
  pullRequest: PullRequestWithDecentData,
  context: ProbotEvent<Name>,
  repoContext: RepoContext,
  reviewflowPrContext: ReviewflowPrContext,
  prTitle: string,
  prBody: string,
  commentBody = reviewflowPrContext.commentBody,
): Promise<void> => {
  const commits = await readPullRequestCommits(context, pullRequest);

  const conventionalCommits = await Promise.all(
    commits.map((c) => parseCommitMessage(c.commit.message)),
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
          .join('\n')}`,
  );

  const hasBreakingChanges = breakingChangesCommits.length > 0;

  // auto update ! in front of : to signal a breaking change
  // prevents squash and merge with missing breaking change in body
  if (
    hasBreakingChanges &&
    repoContext.config.experimentalFeatures
      ?.conventionalCommitBangBreakingChange
  ) {
    try {
      const parsePrTitleAsConventionalCommit = await parseCommitMessage(
        prTitle,
      );
      if (parsePrTitleAsConventionalCommit.type) {
        const typeAndScope = `${parsePrTitleAsConventionalCommit.type}${
          parsePrTitleAsConventionalCommit.scope
            ? `(${parsePrTitleAsConventionalCommit.scope})`
            : ''
        }`;
        if (prTitle.startsWith(`${typeAndScope}:`)) {
          prTitle = `${typeAndScope}!${prTitle.slice(typeAndScope.length)}`;
        }
      }
    } catch {}
  }

  await Promise.all([
    updatePrIfNeeded(pullRequest, context, { title: prTitle, body: prBody }),
    syncLabel(pullRequest, context, hasBreakingChanges, breakingChangesLabel),
    updatePrCommentBodyIfNeeded(context, reviewflowPrContext, newCommentBody),
  ]);
};
