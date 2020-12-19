import type { Probot } from 'probot';
import type { AppContext } from '../../context/AppContext';
import { obtainRepoContext } from '../../context/repoContext';
import { getEmojiFromRepoDescription } from '../../context/utils';
import { createHandlerOrgChange } from '../account-handlers/utils/handler';

export default function repoEdited(app: Probot, appContext: AppContext): void {
  app.on(
    'repository.edited',
    createHandlerOrgChange(
      appContext,
      async (context, orgContext): Promise<void> => {
        const repoContext = await obtainRepoContext(appContext, context);
        if (!repoContext) return;
        const repo = context.payload.repository;
        repoContext.repoFullName = repo.full_name;
        repoContext.repoEmoji = getEmojiFromRepoDescription(repo.description);
      },
    ),
  );
}
