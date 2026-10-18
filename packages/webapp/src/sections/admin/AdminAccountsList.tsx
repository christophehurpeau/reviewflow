import {
  Avatar,
  Badge,
  ErrorMessage,
  Separator,
  Switch,
  Text,
  View,
} from "alouette";
import type { ReactNode } from "react";
import { Fragment, useState } from "react";
import type { AdminAccountSummary } from "reviewflow-modules";
import { SettingsSection } from "#/components/settings-section.tsx";
import { errorToMessage } from "#/errorToMessage.ts";

const formatDate = (date: Date): string =>
  date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

interface AdminAccountRowProps {
  account: AdminAccountSummary;
  onSetEnabled: (enabled: boolean) => Promise<void>;
}

function AdminAccountRow({
  account,
  onSetEnabled,
}: AdminAccountRowProps): ReactNode {
  const [error, setError] = useState<unknown>();
  const labelId = `paid-${account.type}-${account._id}`;

  return (
    <View className="gap-xs">
      {error ? (
        <ErrorMessage variant="flat">{errorToMessage(error)}</ErrorMessage>
      ) : null}
      <View className="flex-row items-center gap-m">
        <Avatar name={account.login} size="sm" />
        <View className="flex-1">
          <Text nativeID={labelId} className="font-body-bold">
            {account.login}
          </Text>
          {account.knownSince ? (
            <Text className="text-sm text-muted">
              {`since ${formatDate(account.knownSince)}`}
            </Text>
          ) : null}
        </View>
        <Badge size="sm" accent={account.paidEnabled ? "success" : "neutral"}>
          {account.paidEnabled ? "enabled" : "not enabled"}
        </Badge>
        <Switch
          checked={account.paidEnabled}
          aria-labelledby={labelId}
          onValueChange={(enabled) => {
            setError(undefined);
            onSetEnabled(enabled).catch(setError);
          }}
        />
      </View>
    </View>
  );
}

interface AdminAccountsListProps {
  title: string;
  accounts: AdminAccountSummary[];
  onSetEnabled: (
    account: AdminAccountSummary,
    enabled: boolean,
  ) => Promise<void>;
}

export function AdminAccountsList({
  title,
  accounts,
  onSetEnabled,
}: AdminAccountsListProps): ReactNode {
  return (
    <SettingsSection title={title}>
      {accounts.length === 0 ? (
        <Text className="text-sm text-muted">Nothing installed yet.</Text>
      ) : null}
      {accounts.map((account, index) => (
        <Fragment key={account._id}>
          {index > 0 ? <Separator /> : null}
          <AdminAccountRow
            account={account}
            onSetEnabled={(enabled) => onSetEnabled(account, enabled)}
          />
        </Fragment>
      ))}
    </SettingsSection>
  );
}
