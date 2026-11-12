import type {
  OrgSummary,
  PrBucket,
  PrFilters,
  PrStateFilter,
  PrSummary,
  UserSummary,
} from "@reviewflow/modules";
import {
  buildPrFilterOptions,
  hasActivePrFilters,
  prBucketGroupTitles,
} from "@reviewflow/modules";
import { EmptyState, ExternalLinkButton, InfoMessage, View } from "alouette";
import { BarricadeRegularIcon } from "alouette-icons/phosphor-icons/Barricade";
import { CheckCircleRegularIcon } from "alouette-icons/phosphor-icons/CheckCircle";
import { ClockRegularIcon } from "alouette-icons/phosphor-icons/Clock";
import { EyeRegularIcon } from "alouette-icons/phosphor-icons/Eye";
import { EyeglassesRegularIcon } from "alouette-icons/phosphor-icons/Eyeglasses";
import { FunnelRegularIcon } from "alouette-icons/phosphor-icons/Funnel";
import { GitMergeRegularIcon } from "alouette-icons/phosphor-icons/GitMerge";
import { TrayRegularIcon } from "alouette-icons/phosphor-icons/Tray";
import { WarningRegularIcon } from "alouette-icons/phosphor-icons/Warning";
import { XCircleRegularIcon } from "alouette-icons/phosphor-icons/XCircle";
import type { ReactNode } from "react";
import type { ResourceResult } from "react-liwi";
import { Columns } from "#/components/columns.tsx";
import { ResourceView } from "#/components/resource-view.tsx";
import { Screen } from "#/components/screen.tsx";
import { StartReviewButton } from "#/components/start-review-button.tsx";
import { reviewflowName } from "#/reviewflowName.ts";
import { getScreenLiveUpdatesPausedBy } from "#/services/getScreenLiveUpdatesPausedBy.ts";
import type { PrBucketResource } from "./PrBucketSection.tsx";
import { PrBucketSection, hasBucketContent } from "./PrBucketSection.tsx";
import { PrGroupSection } from "./PrGroupSection.tsx";
import { PrsEmptyState } from "./PrsEmptyState.tsx";
import { PrsFilters } from "./PrsFilters.tsx";
import { buildPrAccounts } from "./prAccounts.ts";

const installUrl = `https://github.com/apps/${reviewflowName}/installations/new`;

interface PrsScreenProps {
  me: ResourceResult<UserSummary | undefined, Record<string, never>>;
  orgs: ResourceResult<OrgSummary[], Record<string, never>>;
  selectedAccountLogin: string | undefined;
  prsByBucket: Record<PrBucket, PrBucketResource>;
  closedPrs: PrBucketResource;
  /** the account filter is still unresolved, so no bucket has been queried yet */
  pending: boolean;
  state: PrStateFilter;
  filters: PrFilters;
  onSelectAccountLogin: (accountLogin: string | undefined) => void;
  onStateChange: (state: PrStateFilter) => void;
  onFiltersChange: (filters: PrFilters) => void;
  onSelectPr: (pr: PrSummary) => void;
  /** must reject on failure: the row's button renders the message itself */
  onStartReview: (pr: PrSummary) => Promise<void>;
}

function PrsNoMatch(): ReactNode {
  return (
    <EmptyState icon={<FunnelRegularIcon />} title="No match">
      No pull request matches these filters.
    </EmptyState>
  );
}

interface PrsClosedListProps {
  closedPrs: PrBucketResource;
  pending: boolean;
  filters: PrFilters;
  currentUserLogin: string | undefined;
  onSelectPr: (pr: PrSummary) => void;
}

function PrsClosedList({
  closedPrs,
  pending,
  filters,
  currentUserLogin,
  onSelectPr,
}: PrsClosedListProps): ReactNode {
  if (hasBucketContent(closedPrs, pending, filters)) {
    return (
      <PrBucketSection
        title="Closed pull requests"
        icon={<GitMergeRegularIcon />}
        prs={closedPrs}
        pending={pending}
        filters={filters}
        showPassedChecks={false}
        currentUserLogin={currentUserLogin}
        dayOf={(pr) => pr.closedAt}
        onSelectPr={onSelectPr}
      />
    );
  }
  if (hasActivePrFilters(filters)) return <PrsNoMatch />;

  return (
    <EmptyState icon={<TrayRegularIcon />} title="No closed pull requests">
      The pull requests you created, are assigned to or reviewed are listed here
      once closed.
    </EmptyState>
  );
}

export function PrsScreen({
  me,
  orgs,
  selectedAccountLogin,
  prsByBucket,
  closedPrs,
  pending,
  state,
  filters,
  onSelectAccountLogin,
  onStateChange,
  onFiltersChange,
  onSelectPr,
  onStartReview,
}: PrsScreenProps): ReactNode {
  const reReviewsRequested = prsByBucket["re-requested-reviews"];
  const requestedReviews = prsByBucket["requested-reviews"];
  const readyToMerge = prsByBucket["ready-to-merge"];
  const changesRequested = prsByBucket["changes-requested"];
  const waitingForReview = prsByBucket["waiting-for-review"];
  const missingReviewRequest = prsByBucket["opened-missing-review-request"];
  const drafts = prsByBucket.drafts;

  const hasPrsRequestingAttention =
    hasBucketContent(reReviewsRequested, pending, filters) ||
    hasBucketContent(requestedReviews, pending, filters) ||
    hasBucketContent(readyToMerge, pending, filters) ||
    hasBucketContent(changesRequested, pending, filters);
  const hasPrsInProgress =
    hasBucketContent(waitingForReview, pending, filters) ||
    hasBucketContent(missingReviewRequest, pending, filters) ||
    hasBucketContent(drafts, pending, filters);
  const hasOpenPrs = hasPrsRequestingAttention || hasPrsInProgress;
  const openEmptyState = hasActivePrFilters(filters) ? (
    <PrsNoMatch />
  ) : (
    <PrsEmptyState />
  );

  const shownResources =
    state === "closed" ? [closedPrs] : Object.values(prsByBucket);
  const loadedPrs = shownResources.flatMap((resource) =>
    resource.fetched ? resource.data : [],
  );

  return (
    <Screen
      title="Pull requests"
      liveUpdatesPausedBy={getScreenLiveUpdatesPausedBy([
        me,
        orgs,
        ...shownResources,
      ])}
    >
      <ResourceView resource={me}>
        {(user) => (
          <ResourceView resource={orgs}>
            {(orgList) => {
              const accounts = buildPrAccounts(user, orgList);

              if (accounts.length === 0) {
                return (
                  <View className="gap-m md:max-w-[560px]">
                    <InfoMessage>
                      Nothing installed yet. Install reviewflow on your github
                      account or organization to see your pull requests here.
                    </InfoMessage>
                    <View className="flex-row">
                      <ExternalLinkButton
                        href={installUrl}
                        text={`Install ${reviewflowName}`}
                      />
                    </View>
                  </View>
                );
              }

              return (
                <View className="gap-l">
                  <PrsFilters
                    accounts={accounts}
                    selectedAccountLogin={selectedAccountLogin}
                    state={state}
                    filters={filters}
                    options={buildPrFilterOptions(loadedPrs, filters)}
                    onSelectAccountLogin={onSelectAccountLogin}
                    onStateChange={onStateChange}
                    onFiltersChange={onFiltersChange}
                  />

                  {state === "closed" ? (
                    <PrsClosedList
                      closedPrs={closedPrs}
                      pending={pending}
                      filters={filters}
                      currentUserLogin={user?.login}
                      onSelectPr={onSelectPr}
                    />
                  ) : null}

                  {state === "open" && !hasOpenPrs ? openEmptyState : null}

                  {state === "open" && hasOpenPrs ? (
                    <Columns>
                      {hasPrsRequestingAttention ? (
                        <PrGroupSection
                          title={prBucketGroupTitles["requesting-attention"]}
                        >
                          <PrBucketSection
                            title="Re-Requested reviews"
                            icon={<EyeglassesRegularIcon />}
                            accent="brand"
                            prs={reReviewsRequested}
                            pending={pending}
                            filters={filters}
                            showReRequests={false}
                            reviewRequestVerb="requested"
                            currentUserLogin={user?.login}
                            onSelectPr={onSelectPr}
                          />
                          <PrBucketSection
                            title="Requested reviews"
                            icon={<EyeRegularIcon />}
                            accent="brand"
                            prs={requestedReviews}
                            pending={pending}
                            filters={filters}
                            reviewRequestVerb="requested"
                            currentUserLogin={user?.login}
                            renderAction={(pr) => (
                              <StartReviewButton
                                onStartReview={() => onStartReview(pr)}
                              />
                            )}
                            onSelectPr={onSelectPr}
                          />
                          <PrBucketSection
                            title="Ready to merge"
                            icon={<CheckCircleRegularIcon />}
                            accent="success"
                            prs={readyToMerge}
                            pending={pending}
                            filters={filters}
                            reviewRequestVerb="requested"
                            currentUserLogin={user?.login}
                            onSelectPr={onSelectPr}
                          />
                          <PrBucketSection
                            title="Changes requested"
                            icon={<XCircleRegularIcon />}
                            accent="danger"
                            prs={changesRequested}
                            pending={pending}
                            filters={filters}
                            showPassedChecks={false}
                            reviewRequestVerb="requested"
                            currentUserLogin={user?.login}
                            onSelectPr={onSelectPr}
                          />
                        </PrGroupSection>
                      ) : null}

                      {hasPrsInProgress ? (
                        <PrGroupSection
                          title={prBucketGroupTitles["in-progress"]}
                        >
                          <PrBucketSection
                            title="Missing request for review"
                            icon={<WarningRegularIcon />}
                            accent="warning"
                            prs={missingReviewRequest}
                            pending={pending}
                            filters={filters}
                            currentUserLogin={user?.login}
                            onSelectPr={onSelectPr}
                          />
                          <PrBucketSection
                            title="Drafts"
                            icon={<BarricadeRegularIcon />}
                            prs={drafts}
                            pending={pending}
                            filters={filters}
                            showDraft={false}
                            showPassedChecks={false}
                            currentUserLogin={user?.login}
                            onSelectPr={onSelectPr}
                          />
                          <PrBucketSection
                            title="Waiting for review"
                            icon={<ClockRegularIcon />}
                            prs={waitingForReview}
                            pending={pending}
                            filters={filters}
                            currentUserLogin={user?.login}
                            onSelectPr={onSelectPr}
                          />
                        </PrGroupSection>
                      ) : null}
                    </Columns>
                  ) : null}
                </View>
              );
            }}
          </ResourceView>
        )}
      </ResourceView>
    </Screen>
  );
}
