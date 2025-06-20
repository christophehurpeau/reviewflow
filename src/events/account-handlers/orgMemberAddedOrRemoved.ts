import type { Probot } from "probot";
import type { AppContext } from "../../context/AppContext.ts";
import { syncOrg } from "./actions/syncOrg.ts";
import { createHandlerOrgChange } from "./utils/createHandlerOrgChange.ts";

export default function orgMemberAddedOrRemoved(
  app: Probot,
  appContext: AppContext,
): void {
  /* https://developer.github.com/webhooks/event-payloads/#organization */
  createHandlerOrgChange(
    app,
    appContext,
    ["organization.member_added", "organization.member_removed"],
    async (context, accountContext) => {
      const o = await appContext.mongoStores.orgs.findByKey(
        accountContext.accountEmbed.id,
      );
      if (!o?.installationId) return;

      await syncOrg(
        appContext.mongoStores,
        context.octokit,
        o.installationId,
        context.payload.organization,
      );
    },
  );
}
