import type { Context } from 'probot';
import { accountConfigs, defaultConfig } from '../../../accountConfigs';
import type { AppContext } from '../../../context/AppContext';
import type { AccountContext } from '../../../context/accountContext';
import { obtainAccountContext } from '../../../context/accountContext';

type CallbackContextAndAccountContext<T> = (
  context: Context<T>,
  accountContext: AccountContext,
) => void | Promise<void>;

export const handlerOrgChange = async <
  T extends { organization?: { id: number; login: string } },
>(
  appContext: AppContext,
  context: Context<T>,
  callback: CallbackContextAndAccountContext<T>,
): Promise<void> => {
  const org = context.payload.organization;
  if (!org) return;
  const config = accountConfigs[org.login] || defaultConfig;
  const accountContext = await obtainAccountContext(
    appContext,
    context,
    config,
    { ...org, type: 'Organization' },
  );
  if (!accountContext) return;

  return accountContext.lock(async () => {
    await callback(context, accountContext);
  });
};

export const createHandlerOrgChange =
  <T extends { organization?: { id: number; login: string } }>(
    appContext: AppContext,
    callback: CallbackContextAndAccountContext<T>,
  ) =>
  (context: Context<T>) => {
    return handlerOrgChange(appContext, context, callback);
  };
