import type { Probot } from 'probot';
import type { AppContext } from '../../context/AppContext';
import { obtainRepoContext } from '../../context/repoContext';
import { getEmojiFromRepoDescription } from '../../context/utils';
import { getRepositorySettings } from '../../utils/github/repo/getRepositorySettings';
import { createHandlerOrgChange } from '../account-handlers/utils/createHandlerOrgChange';
import { createRepositorySettings } from '../pr-handlers/actions/utils/body/repositorySettings';

export default function repoEdited(app: Probot, appContext: AppContext): void {
  createHandlerOrgChange(
    app,
    appContext,
    'repository.edited',
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
          'account.id': orgContext.accountEmbed.id,
        },
      );
    },
  );
}
