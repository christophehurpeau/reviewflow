import { RepoContext } from '../context/repoContext';

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
