import type { EmitterWebhookEventName } from "@octokit/webhooks";
import type { Probot } from "probot";
import {
  accountConfigs,
  defaultConfig,
} from "../../../accountConfigs/index.ts";
import type { AppContext } from "../../../context/AppContext.ts";
import type { AccountContext } from "../../../context/accountContext.ts";
import { obtainAccountContext } from "../../../context/accountContext.ts";
import type { CustomExtract } from "../../../context/repoContext.ts";
import type { ProbotEvent } from "../../probot-types.ts";

export type EventsWithOrganisation = CustomExtract<
  EmitterWebhookEventName,
  | "membership.added"
  | "membership.removed"
  | "organization.member_added"
  | "organization.member_removed"
  | "repository.archived"
  | "repository.edited"
  | "repository.privatized"
  | "repository.publicized"
  | "repository.renamed"
  | "repository.transferred"
  | "repository.unarchived"
  | "team.created"
  | "team.deleted"
  | "team.edited"
>;

type CallbackContextAndAccountContext<
  EventName extends EventsWithOrganisation,
> = (
  context: ProbotEvent<EventName>,
  accountContext: AccountContext,
) => Promise<void> | void;

export const createHandlerOrgChange = <
  EventName extends EventsWithOrganisation,
>(
  app: Probot,
  appContext: AppContext,
  eventName: EventName | EventName[],
  callback: CallbackContextAndAccountContext<EventName>,
): void => {
  app.on(eventName, async (context) => {
    const org = context.payload.organization;
    if (!org) return;
    const config = accountConfigs[org.login] || defaultConfig;
    const accountContext = await obtainAccountContext<EventName>(
      appContext,
      context,
      config,
      { ...org, type: "Organization" },
    );
    if (!accountContext) return;

    return accountContext.lock(async () => {
      await callback(context, accountContext);
    });
  });
};
