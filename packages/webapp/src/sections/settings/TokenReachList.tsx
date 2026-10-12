import { Avatar, Badge, Text, View, WarningMessage } from "alouette";
import type { ReactNode } from "react";
import type { OrgSummary } from "reviewflow-modules";

interface ReachRowProps {
  login: string;
  allowed: boolean;
}

function ReachRow({ login, allowed }: ReachRowProps): ReactNode {
  return (
    <View className="flex-row items-center gap-m">
      <Avatar name={login} size="sm" />
      <Text className="flex-1 font-body-bold">{login}</Text>
      {allowed ? (
        <Badge size="sm" accent="success">
          allowed
        </Badge>
      ) : (
        <Badge size="sm" accent="neutral">
          not allowed
        </Badge>
      )}
    </View>
  );
}

const formatLogins = (logins: string[]): string =>
  logins.length === 1
    ? logins[0]!
    : `${logins.slice(0, -1).join(", ")} and ${logins.at(-1)}`;

interface TokenReachListProps {
  userLogin: string;
  orgs: OrgSummary[];
}

/** your own account needs no permission: nobody else's data is in it */
export function TokenReachList({
  userLogin,
  orgs,
}: TokenReachListProps): ReactNode {
  const notAllowedLogins = orgs
    .filter((org) => !org.allowPersonalTokens)
    .map((org) => org.login);

  return (
    <View className="gap-m">
      <Text className="font-heading-bold text-lg">Reaches</Text>
      <View className="gap-sm">
        <ReachRow allowed login={userLogin} />
        {orgs.map((org) => (
          <ReachRow
            key={org._id}
            login={org.login}
            allowed={org.allowPersonalTokens}
          />
        ))}
      </View>
      {notAllowedLogins.length > 0 ? (
        <WarningMessage>
          {`Tokens cannot read ${formatLogins(notAllowedLogins)} yet. Ask an owner to allow personal tokens in the organization settings.`}
        </WarningMessage>
      ) : null}
    </View>
  );
}
