import { ExternalLinkButton, HStack, InfoMessage, VStack } from "alouette";
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
import { PrBucketSection } from "./PrBucketSection.tsx";
import { PrsAccountFilter } from "./PrsAccountFilter.tsx";
import { buildPrAccounts } from "./prAccounts.ts";

const installUrl = `https://github.com/apps/${reviewflowName}/installations/new`;

interface BucketSection {
  bucket: PrBucket;
  title: string;
  /** Optional buckets stay out of the page until they have something to show. */
  hideWhenEmpty?: boolean;
}

const sections: BucketSection[] = [
  { bucket: "requested-reviews", title: "Requested reviews" },
  { bucket: "ready-to-merge", title: "Ready to merge" },
  { bucket: "changes-requested", title: "Changes requested" },
  {
    bucket: "waiting-for-review",
    title: "Waiting for review",
    hideWhenEmpty: true,
  },
  {
    bucket: "no-action-planned",
    title: "No action planned",
    hideWhenEmpty: true,
  },
  { bucket: "drafts", title: "Your drafts", hideWhenEmpty: true },
];

const isHidden = (section: BucketSection, prs: PrBucketResource): boolean => {
  if (!section.hideWhenEmpty) return false;
  if (prs.initialLoading) return true;
  return prs.fetched && prs.data.length === 0;
};

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
                  <Columns>
                    {sections
                      .filter(
                        (section) =>
                          pending ||
                          !isHidden(section, prsByBucket[section.bucket]),
                      )
                      .map((section) => (
                        <PrBucketSection
                          key={section.bucket}
                          title={section.title}
                          prs={prsByBucket[section.bucket]}
                          pending={pending}
                          onSelectPr={onSelectPr}
                        />
                      ))}
                  </Columns>
                </VStack>
              );
            }}
          </ResourceView>
        )}
      </ResourceView>
    </Screen>
  );
}
