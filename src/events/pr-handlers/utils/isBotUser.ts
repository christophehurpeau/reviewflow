import { RepoContext } from '../../../context/repoContext';

export const checkIfUserIsBot = (
  repoContext: RepoContext,
  user: { login: string; type: string },
): boolean => {
  if (user.type === 'Bot') return true;
  if (repoContext.config.botUsers) {
    return repoContext.config.botUsers.includes(user.login);
  }
  return false;
};
