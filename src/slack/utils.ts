import type { RepoContext } from '../context/repoContext';
import type { CommitFromRestEndpoint } from '../events/commit-handlers/utils/fetchCommit';
import type {
  PullRequestFromRestEndpoint,
  PullRequestWithDecentData,
} from '../events/pr-handlers/utils/PullRequestData';

// https://api.slack.com/reference/surfaces/formatting#escaping
export const escapeText = (text: string): string => {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
};

export const createLink = (url: string, text: string): string => {
  return `<${url}|${escapeText(text || '')}>`;
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

export const createPrChangesInformation = (
  pr: PullRequestFromRestEndpoint,
  repoContext: RepoContext,
): string => {
  return `${pr.changed_files} file${
    pr.changed_files > 1 ? 's' : ''
  } changed (+${pr.additions} -${pr.deletions})`;
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

export interface CreateOwnerPartOptions {
  isOwner?: boolean;
  isAssigned?: boolean;
}

export const createOwnerPart = (
  repoContext: RepoContext,
  pullRequest: PullRequestWithDecentData,
  { isOwner, isAssigned }: CreateOwnerPartOptions,
): string => {
  if (isOwner) return 'your PR';

  const owner = pullRequest.user;
  const ownerMention = !owner
    ? 'unknown'
    : repoContext.slack.mention(owner.login);

  return `${ownerMention}'s PR${isAssigned ? " you're assigned to" : ''}`;
};
