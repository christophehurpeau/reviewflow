import type { Probot } from "probot";
import type { AccountType, MongoStores } from "reviewflow-core";
import type { AppContext } from "../../context/AppContext";
import { deleteRepoContext } from "../../context/repoContext.ts";

/**
 * The app no longer receives any event for this account, its pull requests
 * would otherwise stay in the webapp forever.
 */
const deleteAccountRepositoriesData = async (
  mongoStores: MongoStores,
  accountId: number,
): Promise<void> => {
  const repositories = await mongoStores.repositories.findAll({
    "account.id": accountId,
  });

  await Promise.all(
    repositories.map((repository) => deleteRepoContext(repository._id)),
  );

  // by account rather than by repository, so documents orphaned by a missed
  // transfer are removed too
  await Promise.all([
    mongoStores.prs.deleteMany({ "account.id": accountId }),
    mongoStores.labels.deleteMany({ "account.id": accountId }),
    mongoStores.repositories.deleteMany({ "account.id": accountId }),
  ]);
};

export default function installation(
  app: Probot,
  appContext: AppContext,
): void {
  /* https://developer.github.com/webhooks/event-payloads/#installation */
  // keep track of installations to know which organizations updated permissions

  app.on("installation", async (context) => {
    const payload = context.payload;
    const account = payload.installation.account;
    if (!account) return;
    await appContext.mongoStores.installationsEvents.insertOne({
      installationId: payload.installation.id,
      account: {
        id: account.id,
        login: (account as any).login as string,
        type: (account as any).type! as AccountType,
      },
      action: payload.action,
      sender: {
        id: payload.sender.id,
        login: payload.sender.login,
        type: payload.sender.type as AccountType,
      },
      data: payload.installation,
    });

    if (
      payload.action === "deleted" ||
      payload.action === "suspend" ||
      payload.action === "unsuspend"
    ) {
      const org = await appContext.mongoStores.orgs.findOne({
        installationId: payload.installation.id,
      });
      if (org) {
        switch (payload.action) {
          case "suspend":
            await appContext.mongoStores.orgs.partialUpdateOne(org, {
              $set: { status: "suspended" },
            });
            break;
          case "unsuspend":
            await appContext.mongoStores.orgs.partialUpdateOne(org, {
              $set: { status: "active" },
            });
            break;
          case "deleted":
            await appContext.mongoStores.orgs.partialUpdateOne(org, {
              $set: { status: "deleted" },
            });
            break;

          default:
            break;
        }
      }

      // outside the org lookup above, an installation on a user account has no org document
      if (payload.action === "deleted") {
        await deleteAccountRepositoriesData(appContext.mongoStores, account.id);
      }
    }
  });
}
