import type { Probot } from "probot";
import type { AccountType } from "src/mongo";
import type { AppContext } from "../../context/AppContext";

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
        id: payload.installation.account.id,
        login: payload.installation.account.login,
        type: payload.installation.account.type as AccountType,
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
    }
  });
}
