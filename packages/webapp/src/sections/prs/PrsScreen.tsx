import { ExternalLinkButton, HStack, InfoMessage, VStack } from "alouette";
import { BarricadeRegularIcon } from "alouette-icons/phosphor-icons/BarricadeRegularIcon";
import { CheckCircleRegularIcon } from "alouette-icons/phosphor-icons/CheckCircleRegularIcon";
import { ClockRegularIcon } from "alouette-icons/phosphor-icons/ClockRegularIcon";
import { EyeRegularIcon } from "alouette-icons/phosphor-icons/EyeRegularIcon";
import { WarningRegularIcon } from "alouette-icons/phosphor-icons/WarningRegularIcon";
import { XCircleRegularIcon } from "alouette-icons/phosphor-icons/XCircleRegularIcon";
import type { ReactNode } from "react";
import type { ResourceResult } from "react-liwi";
import type {
  OrgSummary,
  PrBucket,
  PrSummary,
  UserSummary,
} from "reviewflow-modules";
import { Columns } from "#/components/columns.tsx";
import { ResourceView } from "#/components/resource-view.tsx";
import { Screen } from "#/components/screen.tsx";
import { reviewflowName } from "#/reviewflowName.ts";
import type { PrBucketResource } from "./PrBucketSection.tsx";
import { PrBucketSection, hasBucketContent } from "./PrBucketSection.tsx";
import { PrGroupSection } from "./PrGroupSection.tsx";
import { PrsAccountFilter } from "./PrsAccountFilter.tsx";
import { PrsEmptyState } from "./PrsEmptyState.tsx";
import { buildPrAccounts } from "./prAccounts.ts";

const installUrl = `https://github.com/apps/${reviewflowName}/installations/new`;

interface PrsScreenProps {
  me: ResourceResult<UserSummary | undefined, Record<string, never>>;
  orgs: ResourceResult<OrgSummary[], Record<string, never>>;
  selectedAccountLogin: string | undefined;
  prsByBucket: Record<PrBucket, PrBucketResource>;
  /** the account filter is still unresolved, so no bucket has been queried yet */
  pending: boolean;
  onSelectAccountLogin: (accountLogin: string | undefined) => void;
  onSelectPr: (pr: PrSummary) => void;
}

export function PrsScreen({
  me,
  orgs,
  selectedAccountLogin,
  prsByBucket,
  pending,
  onSelectAccountLogin,
  onSelectPr,
}: PrsScreenProps): ReactNode {
  const requestedReviews = prsByBucket["requested-reviews"];
  const readyToMerge = prsByBucket["ready-to-merge"];
  const changesRequested = prsByBucket["changes-requested"];
  const waitingForReview = prsByBucket["waiting-for-review"];
  const missingReviewRequest = prsByBucket["opened-missing-review-request"];
  const drafts = prsByBucket.drafts;

  const hasPrsRequestingAttention =
    hasBucketContent(requestedReviews, pending) ||
    hasBucketContent(readyToMerge, pending) ||
    hasBucketContent(changesRequested, pending);
  const hasPrsInProgress =
    hasBucketContent(waitingForReview, pending) ||
    hasBucketContent(missingReviewRequest, pending) ||
    hasBucketContent(drafts, pending);

  return (
    <Screen title="Pull requests">
      <ResourceView resource={me}>
        {(user) => (
          <ResourceView resource={orgs}>
            {(orgList) => {
              const accounts = buildPrAccounts(user, orgList);

              if (accounts.length === 0) {
                return (
                  <VStack className="gap-m md:max-w-[560px]">
                    <InfoMessage>
                      Nothing installed yet. Install reviewflow on your github
                      account or organization to see your pull requests here.
                    </InfoMessage>
                    <HStack>
                      <ExternalLinkButton
                        href={installUrl}
                        text={`Install ${reviewflowName}`}
                      />
                    </HStack>
                  </VStack>
                );
              }

              return (
                <VStack className="gap-l">
                  <PrsAccountFilter
                    accounts={accounts}
                    selectedAccountLogin={selectedAccountLogin}
                    onSelectAccountLogin={onSelectAccountLogin}
                  />

                  {!hasPrsRequestingAttention && !hasPrsInProgress ? (
                    <PrsEmptyState />
                  ) : (
                    <Columns>
                      {hasPrsRequestingAttention ? (
                        <PrGroupSection title="PRs requesting your attention">
                          <PrBucketSection
                            title="Requested reviews"
                            icon={<EyeRegularIcon />}
                            prs={requestedReviews}
                            pending={pending}
                            onSelectPr={onSelectPr}
                          />
                          <PrBucketSection
                            title="Ready to merge"
                            icon={<CheckCircleRegularIcon />}
                            iconAccent="success"
                            prs={readyToMerge}
                            pending={pending}
                            onSelectPr={onSelectPr}
                          />
                          <PrBucketSection
                            title="Changes requested"
                            icon={<XCircleRegularIcon />}
                            iconAccent="danger"
                            prs={changesRequested}
                            pending={pending}
                            onSelectPr={onSelectPr}
                          />
                        </PrGroupSection>
                      ) : null}

                      {hasPrsInProgress ? (
                        <PrGroupSection title="Your PRs in progress">
                          <PrBucketSection
                            title="Waiting for review"
                            icon={<ClockRegularIcon />}
                            prs={waitingForReview}
                            pending={pending}
                            onSelectPr={onSelectPr}
                          />
                          <PrBucketSection
                            title="Missing request for review"
                            icon={<WarningRegularIcon />}
                            iconAccent="warning"
                            prs={missingReviewRequest}
                            pending={pending}
                            onSelectPr={onSelectPr}
                          />
                          <PrBucketSection
                            title="Drafts"
                            icon={<BarricadeRegularIcon />}
                            prs={drafts}
                            pending={pending}
                            onSelectPr={onSelectPr}
                          />
                        </PrGroupSection>
                      ) : null}
                    </Columns>
                  )}
                </VStack>
              );
            }}
          </ResourceView>
        )}
      </ResourceView>
    </Screen>
  );
}
