import type { Probot } from "probot";
import type { AppContext } from "../../context/AppContext.ts";
import { deleteRepoContext } from "../../context/repoContext.ts";
import { createRepositoryHandler } from "./utils/createRepositoryHandler.ts";
import { updateRepositoryAccount } from "./utils/updateRepositoryAccount.ts";

export default function repoTransferred(
  app: Probot,
  appContext: AppContext,
): void {
  createRepositoryHandler(
    app,
    appContext,
    "repository.transferred",
    async (context, accountContext): Promise<void> => {
      const repo = context.payload.repository;

      await updateRepositoryAccount({
        mongoStores: appContext.mongoStores,
        repositoryId: repo.id,
        repoName: repo.name,
        fullName: repo.full_name,
        account: accountContext.accountEmbed,
      });

      // the cached context holds the previous account context (config, slack, teams)
      await deleteRepoContext(repo.id);
    },
  );
}
