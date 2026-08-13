import type { Probot } from "probot";
import type { AppContext } from "../../context/AppContext.ts";
import { obtainRepoContext } from "../../context/repoContext.ts";
import { createRepositoryHandler } from "./utils/createRepositoryHandler.ts";

export default function repoRenamed(app: Probot, appContext: AppContext): void {
  createRepositoryHandler(
    app,
    appContext,
    "repository.renamed",
    async (context, accountContext): Promise<void> => {
      const repoContext = await obtainRepoContext(appContext, context);
      if (!repoContext) return;
      const repo = context.payload.repository;

      repoContext.repoFullName = repo.full_name;
      repoContext.repoEmbed.name = repo.name;

      await Promise.all([
        appContext.mongoStores.repositories.partialUpdateByKey(repo.id, {
          $set: {
            account: accountContext.accountEmbed,
            fullName: repo.full_name,
          },
        }),
        appContext.mongoStores.prs.partialUpdateMany(
          {
            "account.id": accountContext.accountEmbed.id,
            "repo.id": repo.id,
          },
          {
            $set: {
              "repo.name": repo.name,
            },
          },
        ),
        appContext.mongoStores.labels.partialUpdateMany(
          {
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
