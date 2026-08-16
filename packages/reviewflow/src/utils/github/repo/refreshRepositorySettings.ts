import type { RepositorySettings } from "reviewflow-core";
import type {
  EventsWithRepository,
  RepoContext,
} from "../../../context/repoContext.ts";
import { createRepositorySettings } from "../../../events/pr-handlers/actions/utils/body/repositorySettings.ts";
import type { ProbotEvent } from "../../../events/probot-types.ts";
import { getRepositorySettings } from "./getRepositorySettings.ts";

// repository settings are cached for the lifetime of the process and only refreshed on
// `repository.edited`, which github does not send when the merge settings change: a
// mutation rejected by github is the only signal that the cached value is stale.
export const refreshRepositorySettings = async <
  EventName extends EventsWithRepository,
>(
  context: ProbotEvent<EventName>,
  repoContext: RepoContext,
): Promise<RepositorySettings> => {
  const repoSettingsResult = await getRepositorySettings(context);
  repoContext.settings = createRepositorySettings(repoSettingsResult);

  await repoContext.appContext.mongoStores.repositories.partialUpdateByKey(
    repoContext.repoEmbed.id,
    { $set: { settings: repoContext.settings } },
  );

  return repoContext.settings;
};
