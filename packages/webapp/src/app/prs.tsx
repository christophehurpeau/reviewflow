import { useLocalSearchParams, useRouter } from "expo-router";
import type { ReactNode } from "react";
import { useResource } from "react-liwi";
import { PrsScreen } from "#/sections/prs/PrsScreen.tsx";
import { buildPrAccounts } from "#/sections/prs/prAccounts.ts";
import { useReviewflowServices } from "#/services/ReviewflowServicesProvider.tsx";
import { useMyPrsByBucket } from "#/services/useMyPrsByBucket.ts";

const openPr = (url: string): void => {
  globalThis.open(url, "_blank", "noopener");
};

export default function PrsPage(): ReactNode {
  const router = useRouter();
  const { account: accountLogin } = useLocalSearchParams<{
    account?: string;
  }>();
  const { orgsService, usersService } = useReviewflowServices();

  const me = useResource(usersService.queries.queryMe, { subscribe: true }, []);
  const orgs = useResource(
    orgsService.queries.queryMyOrgs,
    { subscribe: true },
    [],
  );

  // the filter is a login, the query needs an id: an unknown login is dropped
  // rather than kept pending, so a stale link still shows something.
  const selectedAccount =
    me.fetched && orgs.fetched
      ? buildPrAccounts(me.data, orgs.data).find(
          (account) => account.login === accountLogin,
        )
      : undefined;
  const pending = accountLogin !== undefined && !(me.fetched && orgs.fetched);

  const prsByBucket = useMyPrsByBucket({
    accountId: selectedAccount?.id ?? null,
    skip: pending,
  });

  return (
    <PrsScreen
      me={me}
      orgs={orgs}
      selectedAccountLogin={selectedAccount?.login}
      prsByBucket={prsByBucket}
      pending={pending}
      onSelectAccountLogin={(login) => {
        router.replace(
          login ? { pathname: "/prs", params: { account: login } } : "/prs",
        );
      }}
      onSelectPr={(pr) => {
        openPr(pr.url);
      }}
    />
  );
}
