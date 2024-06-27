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
    const account = context.payload.installation.account;
    if (!account) return;
    await appContext.mongoStores.installationsEvents.insertOne({
      installationId: context.payload.installation.id,
      account: {
        id: context.payload.installation.account.id,
        login: context.payload.installation.account.login,
        type: context.payload.installation.account.type as AccountType,
      },
      action: context.payload.action,
      sender: {
        id: context.payload.sender.id,
        login: context.payload.sender.login,
        type: context.payload.sender.type as AccountType,
      },
      data: context.payload.installation,
    });
  });
}
