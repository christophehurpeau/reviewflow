import type { Probot } from "probot";
import type { AppContext } from "../../context/AppContext";
import { obtainRepoContext } from "../../context/repoContext";
import { createHandlerOrgChange } from "../account-handlers/utils/createHandlerOrgChange";

export default function repoRenamed(app: Probot, appContext: AppContext): void {
  createHandlerOrgChange(
    app,
    appContext,
    "repository.renamed",
    async (context, orgContext): Promise<void> => {
      const repoContext = await obtainRepoContext(appContext, context);
      if (!repoContext) return;
      const repo = context.payload.repository;

      repoContext.repoFullName = repo.full_name;
      repoContext.repoEmbed.name = repo.name;

      await Promise.all([
        appContext.mongoStores.repositories.partialUpdateByKey(
          repo.id,
          {
            $set: {
              fullName: repo.full_name,
            },
          },
          {
            "account.id": orgContext.accountEmbed.id,
          },
        ),
        appContext.mongoStores.prs.partialUpdateMany(
          {
            "account.id": orgContext.accountEmbed.id,
            "repo.id": repo.id,
          },
          {
            $set: {
              "repo.name": repo.name,
            },
          },
        ),
        appContext.mongoStores.repositoryMergeQueue.partialUpdateMany(
          {
            "account.id": orgContext.accountEmbed.id,
            "repo.id": repo.id,
          },
          {
            $set: {
              "repo.name": repo.name,
            },
          },
        ),
      ]);
    },
  );
}
