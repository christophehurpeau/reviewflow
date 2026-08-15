import type { Probot } from "probot";
import type { AppContext } from "../../context/AppContext.ts";
import { deleteRepositoryData } from "../repository-handlers/utils/deleteRepositoryData.ts";

/**
 * Also the event github delivers when a repository is deleted on an
 * installation limited to selected repositories.
 */
export default function installationRepositoriesRemoved(
  app: Probot,
  appContext: AppContext,
): void {
  app.on("installation_repositories.removed", async (context) => {
    await Promise.all(
      context.payload.repositories_removed.map((repository) =>
        deleteRepositoryData({
          mongoStores: appContext.mongoStores,
          repositoryId: repository.id,
        }),
      ),
    );
  });
}
