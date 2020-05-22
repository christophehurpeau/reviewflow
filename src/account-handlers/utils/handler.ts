import { Context } from 'probot';
import { accountConfigs, defaultConfig } from '../../accountConfigs';
import { MongoStores } from '../../mongo';
import {
  AccountContext,
  obtainAccountContext,
} from '../../context/accountContext';

type CallbackContextAndAccountContext<T> = (
  context: Context<T>,
  accountContext: AccountContext,
) => void | Promise<void>;

export const handlerOrgChange = async <
  T extends { organization: { id: number; login: string } }
>(
  mongoStores: MongoStores,
  context: Context<T>,
  callback: CallbackContextAndAccountContext<T>,
): Promise<void> => {
  const org = context.payload.organization;
  const config = accountConfigs[org.login] || defaultConfig;
  const accountContext = await obtainAccountContext(
    mongoStores,
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
  mongoStores: MongoStores,
  callback: CallbackContextAndAccountContext<T>,
) => (context: Context<T>) => {
  return handlerOrgChange(mongoStores, context, callback);
};
