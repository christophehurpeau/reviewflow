import type { EmitterWebhookEventName } from "@octokit/webhooks";
import type { Probot } from "probot";
import { accountConfigs, defaultConfig } from "reviewflow-core";
import type { AppContext } from "../../../context/AppContext.ts";
import type { AccountContext } from "../../../context/accountContext.ts";
import { obtainAccountContext } from "../../../context/accountContext.ts";
import type {
  CustomExtract,
  EventsWithRepository,
} from "../../../context/repoContext.ts";
import type { ProbotEvent } from "../../probot-types.ts";

/**
 * Repository events handled from `repository.owner`, so they also apply to
 * repositories owned by a user account, for which `payload.organization` is absent.
 * `repository_ruleset` payloads may have no `repository` (organization rulesets):
 * they are ignored here.
 */
export type EventsWithRepositoryOwner = CustomExtract<
  EmitterWebhookEventName,
  | "branch_protection_rule.created"
  | "branch_protection_rule.deleted"
  | "branch_protection_rule.edited"
  | "label.created"
  | "label.deleted"
  | "label.edited"
  | "repository_ruleset.created"
  | "repository_ruleset.deleted"
  | "repository_ruleset.edited"
  | "repository.edited"
  | "repository.renamed"
  | "repository.transferred"
>;

type CallbackContextAndAccountContext<
  EventName extends EventsWithRepositoryOwner,
> = (
  context: ProbotEvent<EventName>,
  accountContext: AccountContext,
) => Promise<void> | void;

export const createRepositoryHandler = <
  EventName extends EventsWithRepositoryOwner,
>(
  app: Probot,
  appContext: AppContext,
  eventName: EventName | EventName[],
  callback: CallbackContextAndAccountContext<EventName>,
): void => {
  app.on(eventName, async (context) => {
    const owner = context.payload.repository?.owner;
    if (!owner) return;
    const repositoryContext = context as ProbotEvent<EventsWithRepository>;
    const config = accountConfigs[owner.login] || defaultConfig;
    const accountContext = await obtainAccountContext(
      appContext,
      repositoryContext,
      config,
      owner,
    );
    if (!accountContext) return;

    return accountContext.lock(async () => {
      await callback(context, accountContext);
    });
  });
};
