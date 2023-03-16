import type { EmitterWebhookEventName } from '@octokit/webhooks';
import type { Probot } from 'probot';
import { accountConfigs, defaultConfig } from '../../../accountConfigs';
import type { AppContext } from '../../../context/AppContext';
import type { AccountContext } from '../../../context/accountContext';
import { obtainAccountContext } from '../../../context/accountContext';
import type { CustomExtract } from '../../../context/repoContext';
import type { ProbotEvent } from '../../probot-types';

export type EventsWithOrganisation = CustomExtract<
  EmitterWebhookEventName,
  | 'team.created'
  | 'team.deleted'
  | 'team.edited'
  | 'repository.edited'
  | 'repository.renamed'
  | 'repository.archived'
  | 'repository.transferred'
  | 'repository.unarchived'
  | 'repository.privatized'
  | 'repository.publicized'
  | 'organization.member_added'
  | 'organization.member_removed'
  | 'membership.added'
  | 'membership.removed'
>;

type CallbackContextAndAccountContext<
  EventName extends EventsWithOrganisation,
> = (
  context: ProbotEvent<EventName>,
  accountContext: AccountContext,
) => void | Promise<void>;

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
      { ...org, type: 'Organization' },
    );
    if (!accountContext) return;

    return accountContext.lock(async () => {
      await callback(context, accountContext);
    });
  });
};
