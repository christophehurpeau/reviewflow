import type { Probot } from "probot";
import { getEmojiFromRepoDescription } from "reviewflow-core";
import type { AppContext } from "../../context/AppContext.ts";
import { obtainRepoContext } from "../../context/repoContext.ts";
import { getRepositorySettings } from "../../utils/github/repo/getRepositorySettings.ts";
import { createRepositorySettings } from "../pr-handlers/actions/utils/body/repositorySettings.ts";
import { createRepositoryHandler } from "./utils/createRepositoryHandler.ts";

export default function repoEdited(app: Probot, appContext: AppContext): void {
  createRepositoryHandler(
    app,
    appContext,
    "repository.edited",
    async (context, accountContext): Promise<void> => {
      const repoContext = await obtainRepoContext(appContext, context);
      if (!repoContext) return;
      const repo = context.payload.repository;
      const repoSettingsResult = await getRepositorySettings(context);

      repoContext.repoFullName = repo.full_name;
      repoContext.repoEmoji = getEmojiFromRepoDescription(repo.description);
      repoContext.settings = createRepositorySettings(repoSettingsResult);

      await appContext.mongoStores.repositories.partialUpdateByKey(repo.id, {
        $set: {
          account: accountContext.accountEmbed,
          fullName: repo.full_name,
          emoji: repoContext.repoEmoji,
          settings: repoContext.settings,
        },
      });
    },
  );
}
