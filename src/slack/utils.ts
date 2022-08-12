import type { AccountInfo } from '../context/getOrCreateAccount';
import type { RepoContext } from '../context/repoContext';
import type { CommitFromRestEndpoint } from '../events/commit-handlers/utils/fetchCommit';
import type { PullRequestWithDecentData } from '../events/pr-handlers/utils/PullRequestData';

export const createLink = (url: string, text: string): string => {
  return `<${url}|${text}>`;
};

export const createPrLink = (
  pr: { html_url: string; number: number },
  repoContext: RepoContext,
): string => {
  return createLink(
    pr.html_url,
    `${repoContext.repoEmoji ? `${repoContext.repoEmoji} ` : ''}${
      repoContext.repoFullName
    }#${pr.number}`,
  );
};

export const createCommitLink = (
  commit: CommitFromRestEndpoint,
  repoContext: RepoContext,
): string => {
  return createLink(
    commit.html_url,
    `${repoContext.repoEmoji ? `${repoContext.repoEmoji} ` : ''}${
      repoContext.repoFullName
    }#${commit.sha}`,
  );
};

export const createOwnerPart = (
  ownerMention: string,
  pullRequest: PullRequestWithDecentData,
  sendTo: AccountInfo,
): string => {
  const owner = pullRequest.user;

  if (owner && owner.id === sendTo.id) return 'your PR';

  const isAssignedTo: boolean =
    !!pullRequest.assignees &&
    pullRequest.assignees.some((a: any) => a && a.id === sendTo.id);

  return `${ownerMention}'s PR${isAssignedTo ? " you're assigned to" : ''}`;
};
