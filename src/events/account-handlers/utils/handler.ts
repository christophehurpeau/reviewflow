import { Context } from 'probot';
import { accountConfigs, defaultConfig } from '../../../accountConfigs';
import {
  AccountContext,
  obtainAccountContext,
} from '../../../context/accountContext';
import { AppContext } from '../../../context/AppContext';

type CallbackContextAndAccountContext<T> = (
  context: Context<T>,
  accountContext: AccountContext,
) => void | Promise<void>;

export const handlerOrgChange = async <
  T extends { organization: { id: number; login: string } }
>(
  appContext: AppContext,
  context: Context<T>,
  callback: CallbackContextAndAccountContext<T>,
): Promise<void> => {
  const org = context.payload.organization;
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

export const createHandlerOrgChange = <
  T extends { organization: { id: number; login: string } }
>(
  appContext: AppContext,
  callback: CallbackContextAndAccountContext<T>,
) => (context: Context<T>) => {
  return handlerOrgChange(appContext, context, callback);
};
