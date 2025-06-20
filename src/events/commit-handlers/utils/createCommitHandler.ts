import type { Probot } from "probot";
import { catchExceptedErrors } from "../../../ExpectedError.ts";
import type { AppContext } from "../../../context/AppContext.ts";
import type {
  CustomExtract,
  EventsWithRepository,
  RepoContext,
} from "../../../context/repoContext.ts";
import { obtainRepoContext } from "../../../context/repoContext.ts";
import type { ProbotEvent } from "../../probot-types.ts";
import { fetchCommit } from "./fetchCommit.ts";
import type { CommitFromRestEndpoint } from "./fetchCommit.ts";

export type EventsWithCommit = CustomExtract<
  EventsWithRepository,
  "commit_comment.created"
>;

export const createCommitHandler = <
  EventName extends EventsWithCommit,
  TeamNames extends string = string,
>(
  app: Probot,
  appContext: AppContext,
  eventName: EventName | EventName[],
  callback: (
    commit: CommitFromRestEndpoint,
    context: ProbotEvent<EventName>,
    repoContext: RepoContext<TeamNames>,
  ) => Promise<void> | void,
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
