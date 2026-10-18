import { Avatar, Badge, Text, View, WarningMessage } from "alouette";
import type { ReactNode } from "react";
import type { OrgSummary } from "reviewflow-modules";
import { NotEnabledMessage } from "#/components/not-enabled-message.tsx";

type Reach = "allowed" | "notAllowed" | "notEnabled";

interface ReachRowProps {
  login: string;
  reach: Reach;
}

function ReachRow({ login, reach }: ReachRowProps): ReactNode {
  return (
    <View className="flex-row items-center gap-m">
      <Avatar name={login} size="sm" />
      <Text className="flex-1 font-body-bold">{login}</Text>
      {reach === "allowed" ? (
        <Badge size="sm" accent="success">
          allowed
        </Badge>
      ) : null}
      {reach === "notAllowed" ? (
        <Badge size="sm" accent="neutral">
          not allowed
        </Badge>
      ) : null}
      {reach === "notEnabled" ? (
        <Badge size="sm" accent="warning">
          not enabled
        </Badge>
      ) : null}
    </View>
  );
}

const formatLogins = (logins: string[]): string =>
  logins.length === 1
    ? logins[0]!
    : `${logins.slice(0, -1).join(", ")} and ${logins.at(-1)}`;

const reachOfOrg = (org: OrgSummary): Reach => {
  if (!org.paidEnabled) return "notEnabled";
  return org.allowPersonalTokens ? "allowed" : "notAllowed";
};

interface TokenReachListProps {
  userLogin: string;
  userPaidEnabled: boolean;
  orgs: OrgSummary[];
}

/** your own account needs the admin's enabling only, an org its owners' permission too */
export function TokenReachList({
  userLogin,
  userPaidEnabled,
  orgs,
}: TokenReachListProps): ReactNode {
  const notEnabledLogins = [
    ...(userPaidEnabled ? [] : [userLogin]),
    ...orgs.filter((org) => !org.paidEnabled).map((org) => org.login),
  ];
  const notAllowedLogins = orgs
    .filter((org) => reachOfOrg(org) === "notAllowed")
    .map((org) => org.login);

  return (
    <View className="gap-m">
      <Text className="font-heading-bold text-lg">Reaches</Text>
      <View className="gap-sm">
        <ReachRow
          login={userLogin}
          reach={userPaidEnabled ? "allowed" : "notEnabled"}
        />
        {orgs.map((org) => (
          <ReachRow key={org._id} login={org.login} reach={reachOfOrg(org)} />
        ))}
      </View>
      {notEnabledLogins.length > 0 ? (
        <NotEnabledMessage>
          {`The API is not enabled for ${formatLogins(notEnabledLogins)}.`}
        </NotEnabledMessage>
      ) : null}
      {notAllowedLogins.length > 0 ? (
        <WarningMessage>
          {`Tokens cannot read ${formatLogins(notAllowedLogins)} yet. Ask an owner to allow personal tokens in the organization settings.`}
        </WarningMessage>
      ) : null}
    </View>
  );
}
