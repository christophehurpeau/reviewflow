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

export const checkIfIsThisBot = (user: {
  login: string;
  type: string;
}): boolean => {
  return (
    user.type === 'Bot' && user.login === `${process.env.REVIEWFLOW_NAME}[bot]`
  );
};
