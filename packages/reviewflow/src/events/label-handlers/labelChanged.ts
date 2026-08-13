import type { Probot } from "probot";
import type { AppContext } from "../../context/AppContext.ts";
import { createRepositoryHandler } from "../repository-handlers/utils/createRepositoryHandler.ts";

/**
 * `initRepoLabels` only syncs the `labels` collection when a repo context is created,
 * these events keep the name, color and description accurate in between.
 */
export default function labelChanged(
  app: Probot,
  appContext: AppContext,
): void {
  createRepositoryHandler(
    app,
    appContext,
    ["label.created", "label.edited"],
    async (context, accountContext): Promise<void> => {
      const { label, repository: repo } = context.payload;

      await appContext.mongoStores.labels.upsertOne({
        _id: label.id,
        account: accountContext.accountEmbed,
        repo: { id: repo.id, name: repo.name },
        name: label.name,
        color: label.color,
        description: label.description ?? null,
      });

      const previousName =
        context.payload.action === "edited"
          ? context.payload.changes?.name?.from
          : undefined;

      if (previousName !== undefined && previousName !== label.name) {
        // pull requests embed the label name to be displayed without reading this collection
        await appContext.mongoStores.prs.partialUpdateMany(
          { "repo.id": repo.id, "labels.id": label.id },
          { $set: { "labels.$.name": label.name } },
        );
      }
    },
  );

  createRepositoryHandler(
    app,
    appContext,
    "label.deleted",
    async (context): Promise<void> => {
      const { label, repository: repo } = context.payload;

      await Promise.all([
        appContext.mongoStores.labels.deleteByKey(label.id),
        appContext.mongoStores.prs.partialUpdateMany(
          { "repo.id": repo.id, "labels.id": label.id },
          { $pull: { labels: { id: label.id } } },
        ),
      ]);
    },
  );
}
