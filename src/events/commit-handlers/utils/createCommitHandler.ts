import type { Probot } from 'probot';
import type { ProbotEvent } from 'events/probot-types';
import { catchExceptedErrors } from '../../../ExpectedError';
import type { AppContext } from '../../../context/AppContext';
import type {
  RepoContext,
  CustomExtract,
  EventsWithRepository,
} from '../../../context/repoContext';
import { obtainRepoContext } from '../../../context/repoContext';
import { fetchCommit } from './fetchCommit';
import type { CommitFromRestEndpoint } from './fetchCommit';

export type EventsWithCommit = CustomExtract<
  EventsWithRepository,
  'commit_comment.created'
>;

export const createCommitHandler = <
  EventName extends EventsWithCommit,
  GroupNames extends string = string,
>(
  app: Probot,
  appContext: AppContext,
  eventName: EventName | EventName[],
  callback: (
    commit: CommitFromRestEndpoint,
    context: ProbotEvent<EventName>,
    repoContext: RepoContext<GroupNames>,
  ) => void | Promise<void>,
): void => {
  app.on(eventName, async (context: ProbotEvent<EventName>) => {
    return catchExceptedErrors(async () => {
      const [commit, repoContext] = await Promise.all([
        fetchCommit(context, context.payload.comment.commit_id),
        obtainRepoContext(appContext, context),
      ]);
      return callback(commit, context, repoContext);
    });
  });
};
