import type { Probot } from "probot";
import type { AppContext } from "../../context/AppContext.ts";
import { deleteRepositoryData } from "./utils/deleteRepositoryData.ts";

/**
 * Registered without `createRepositoryHandler`: obtaining the account context
 * calls the github api for teams and slack, and creates account documents,
 * none of which deleting by repository id needs.
 */
export default function repoDeleted(app: Probot, appContext: AppContext): void {
  app.on("repository.deleted", async (context) => {
    await deleteRepositoryData({
      mongoStores: appContext.mongoStores,
      repositoryId: context.payload.repository.id,
    });
  });
}
