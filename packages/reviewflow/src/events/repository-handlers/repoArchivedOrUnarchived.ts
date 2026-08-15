import type { Probot } from "probot";
import type { AppContext } from "../../context/AppContext.ts";
import { setRepositoryArchived } from "./utils/setRepositoryArchived.ts";

/**
 * Registered without `createRepositoryHandler`: obtaining the account context
 * calls the github api for teams and slack, and creates account documents,
 * none of which flagging by repository id needs.
 */
export default function repoArchivedOrUnarchived(
  app: Probot,
  appContext: AppContext,
): void {
  app.on(["repository.archived", "repository.unarchived"], async (context) => {
    await setRepositoryArchived({
      mongoStores: appContext.mongoStores,
      repositoryId: context.payload.repository.id,
      archived: context.payload.action === "archived",
    });
  });
}
