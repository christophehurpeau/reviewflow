import type { RestEndpointMethodTypes } from '@octokit/plugin-rest-endpoint-methods';
import type { RepoContext } from '../../context/repoContext';

export const checkIfUserIsBot = (
  repoContext: RepoContext,
  user: { login: string; type: string },
): boolean => {
  if (user.type === 'Bot') return true;
  if (user.login.endsWith('-bot')) return true;
  if (repoContext.config.botUsers) {
    return repoContext.config.botUsers.includes(user.login);
  }
  return false;
};

export const checkIfIsThisBot = (user: {
  login: string;
  type: string;
}): boolean => {
  return (
    user.type === 'Bot' && user.login === `${process.env.REVIEWFLOW_NAME}[bot]`
  );
};

export const areCommitsAllMadeByBots = (
  repoContext: RepoContext,
  commits: RestEndpointMethodTypes['pulls']['listCommits']['response']['data'],
): boolean =>
  commits.every((c) => c.author && checkIfUserIsBot(repoContext, c.author));
