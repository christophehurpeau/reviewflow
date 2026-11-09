import type { PrFilters, PrStateFilter } from "@reviewflow/modules";
import {
  parsePrFilters,
  parsePrStateFilter,
  prFiltersForAccount,
  toPrFilterParams,
} from "@reviewflow/modules";
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
  const params = useLocalSearchParams<{
    account?: string;
    state?: string;
    repo?: string;
    author?: string;
    draft?: string;
    checks?: string;
    search?: string;
    review?: string;
    label?: string;
    inactive?: string;
  }>();
  const accountLogin = params.account;
  const state = parsePrStateFilter(params.state);
  const filters = parsePrFilters(params);
  const { orgsService, prsService, usersService } = useReviewflowServices();

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

  const accountId = selectedAccount?.id ?? null;
  const prsByBucket = useMyPrsByBucket({
    accountId,
    skip: pending || state === "closed",
  });
  const closedPrs = useResource(
    prsService.queries.queryMyPrs,
    {
      params: { accountId, bucket: "closed" },
      subscribe: true,
      skip: pending || state === "open",
    },
    [accountId, pending, state],
  );

  const showPrs = (next: {
    login: string | undefined;
    state: PrStateFilter;
    filters: PrFilters;
  }): void => {
    router.replace({
      pathname: "/prs",
      params: {
        ...(next.login ? { account: next.login } : {}),
        ...toPrFilterParams(next.state, next.filters),
      },
    });
  };

  return (
    <PrsScreen
      me={me}
      orgs={orgs}
      selectedAccountLogin={selectedAccount?.login}
      prsByBucket={prsByBucket}
      closedPrs={closedPrs}
      pending={pending}
      state={state}
      filters={filters}
      onSelectAccountLogin={(login) => {
        showPrs({
          login,
          state,
          filters: prFiltersForAccount(filters, login),
        });
      }}
      onStateChange={(nextState) => {
        showPrs({
          login: selectedAccount?.login,
          state: nextState,
          filters,
        });
      }}
      onFiltersChange={(nextFilters) => {
        showPrs({
          login: selectedAccount?.login,
          state,
          filters: nextFilters,
        });
      }}
      onSelectPr={(pr) => {
        openPr(pr.url);
      }}
      onStartReview={async (pr) => {
        // opened first, and synchronously: the review is done on github, and a
        // tab opened after awaiting is no longer part of the press the browser
        // is willing to open one for
        openPr(pr.url);
        await prsService.operations.startReview({ prId: pr._id });
      }}
    />
  );
}
