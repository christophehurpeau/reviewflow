import type { Probot } from "probot";
import type { AppContext } from "../../context/AppContext.ts";
import { obtainRepoContext } from "../../context/repoContext.ts";
import { getEmojiFromRepoDescription } from "../../context/utils.ts";
import { getRepositorySettings } from "../../utils/github/repo/getRepositorySettings.ts";
import { createHandlerOrgChange } from "../account-handlers/utils/createHandlerOrgChange.ts";
import { createRepositorySettings } from "../pr-handlers/actions/utils/body/repositorySettings.ts";

export default function repoEdited(app: Probot, appContext: AppContext): void {
  createHandlerOrgChange(
    app,
    appContext,
    "repository.edited",
    async (context, orgContext): Promise<void> => {
      const repoContext = await obtainRepoContext(appContext, context);
      if (!repoContext) return;
      const repo = context.payload.repository;
      const repoSettingsResult = await getRepositorySettings(context);

      repoContext.repoFullName = repo.full_name;
      repoContext.repoEmoji = getEmojiFromRepoDescription(repo.description);
      repoContext.settings = createRepositorySettings(repoSettingsResult);

      await appContext.mongoStores.repositories.partialUpdateByKey(
        repo.id,
        {
          $set: {
            fullName: repo.full_name,
            emoji: repoContext.repoEmoji,
            settings: repoContext.settings,
          },
        },
        {
          "account.id": orgContext.accountEmbed.id,
        },
      );
    },
  );
}
