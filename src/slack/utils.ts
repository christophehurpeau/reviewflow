import type { AccountInfo } from 'context/getOrCreateAccount';
import type { PullRequestWithDecentData } from 'events/pr-handlers/utils/PullRequestData';
import type { RepoContext } from '../context/repoContext';

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

export const createOwnerPart = (
  ownerMention: string,
  pullRequest: PullRequestWithDecentData,
  sendTo: AccountInfo,
): string => {
  const owner = pullRequest.user;

  if (owner.id === sendTo.id) return 'your PR';

  const isAssignedTo = pullRequest.assignees.some((a) => a.id === sendTo.id);

  return `${ownerMention}'s PR${isAssignedTo ? " you're assigned to" : ''}`;
};
