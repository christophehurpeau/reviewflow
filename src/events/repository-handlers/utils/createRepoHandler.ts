import { PayloadRepository } from '@octokit/webhooks';
import { Context } from 'probot';
import { OnCallback } from 'probot/lib/application';
import { RepoContext, obtainRepoContext } from 'context/repoContext';
import { AppContext } from 'context/AppContext';

export const createRepoHandler = <T extends { repository: PayloadRepository }>(
  appContext: AppContext,
  callback: (
    context: Context<T>,
    repoContext: RepoContext,
  ) => Promise<void> | void,
): OnCallback<T> => {
  return async (context): Promise<void> => {
    const repoContext = await obtainRepoContext(appContext, context);
    if (!repoContext) return;

    return callback(context, repoContext);
  };
};
