import type { Probot } from 'probot';
import type { AppContext } from '../../context/AppContext';
import { obtainRepoContext } from '../../context/repoContext';
import { getEmojiFromRepoDescription } from '../../context/utils';
import { createHandlerOrgChange } from '../account-handlers/utils/createHandlerOrgChange';
import { parseRepositoryOptions } from '../pr-handlers/actions/utils/body/repositoryOptions';

export default function repoEdited(app: Probot, appContext: AppContext): void {
  createHandlerOrgChange(
    app,
    appContext,
    'repository.edited',
    async (context, orgContext): Promise<void> => {
      const repoContext = await obtainRepoContext(appContext, context);
      if (!repoContext) return;
      const repo = context.payload.repository;
      repoContext.repoFullName = repo.full_name;
      repoContext.repoEmoji = getEmojiFromRepoDescription(repo.description);
      repoContext.defaultBranch = repo.default_branch;
      await appContext.mongoStores.repositories.partialUpdateByKey(
        repo.id,
        {
          $set: {
            fullName: repo.full_name,
            emoji: repoContext.repoEmoji,
            options: parseRepositoryOptions(repo),
          },
        },
        {
          'account.id': orgContext.accountEmbed.id,
        },
      );
    },
  );
}
