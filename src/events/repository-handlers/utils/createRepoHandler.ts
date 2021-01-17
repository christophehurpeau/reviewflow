import type { EventPayloads } from '@octokit/webhooks';
import type { Context } from 'probot';
import type { AppContext } from '../../../context/AppContext';
import type { RepoContext } from '../../../context/repoContext';
import { obtainRepoContext } from '../../../context/repoContext';

export const createRepoHandler = <
  T extends { repository: EventPayloads.PayloadRepository }
>(
  appContext: AppContext,
  callback: (
    context: Context<T>,
    repoContext: RepoContext,
  ) => Promise<void> | void,
): ((context: Context<T>) => Promise<void>) => {
  return async (context): Promise<void> => {
    const repoContext = await obtainRepoContext(appContext, context);
    if (!repoContext) return;

    return callback(context, repoContext);
  };
};
