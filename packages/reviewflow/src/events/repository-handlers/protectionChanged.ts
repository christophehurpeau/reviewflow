import type { Probot } from "probot";
import type { AppContext } from "../../context/AppContext.ts";
import type { EventsWithRepository } from "../../context/repoContext.ts";
import { obtainRepoContext } from "../../context/repoContext.ts";
import { refreshRepositorySettings } from "../../utils/github/repo/refreshRepositorySettings.ts";
import type { ProbotEvent } from "../probot-types.ts";
import { createRepositoryHandler } from "./utils/createRepositoryHandler.ts";

/**
 * An organization ruleset has no `repository` in its payload: nothing to
 * refresh here, the periodic refresh in `obtainRepoContext` picks it up.
 * `repository_ruleset` is not in `EventsWithRepository` because its payload
 * type makes `repository` optional.
 */
export default function protectionChanged(
  app: Probot,
  appContext: AppContext,
): void {
  createRepositoryHandler(
    app,
    appContext,
    [
      "branch_protection_rule.created",
      "branch_protection_rule.deleted",
      "branch_protection_rule.edited",
      "repository_ruleset.created",
      "repository_ruleset.deleted",
      "repository_ruleset.edited",
    ],
    async (context): Promise<void> => {
      const repositoryContext = context as ProbotEvent<EventsWithRepository>;
      const repoContext = await obtainRepoContext(
        appContext,
        repositoryContext,
      );
      if (!repoContext) return;
      await refreshRepositorySettings(repositoryContext, repoContext);
    },
  );
}
