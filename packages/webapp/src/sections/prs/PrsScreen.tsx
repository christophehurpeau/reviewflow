import { ExternalLinkButton, HStack, InfoMessage, VStack } from "alouette";
import type { ReactNode } from "react";
import type { ResourceResult } from "react-liwi";
import type { OrgSummary, PrBucket, PrSummary } from "reviewflow-modules";
import { Columns } from "#/components/columns.tsx";
import { ResourceView } from "#/components/resource-view.tsx";
import { Screen } from "#/components/screen.tsx";
import { reviewflowName } from "#/reviewflowName.ts";
import type { PrBucketResource } from "./PrBucketSection.tsx";
import { PrBucketSection } from "./PrBucketSection.tsx";
import { PrsOrgFilter } from "./PrsOrgFilter.tsx";

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
  orgs: ResourceResult<OrgSummary[], Record<string, never>>;
  selectedOrgLogin: string | undefined;
  prsByBucket: Record<PrBucket, PrBucketResource>;
  /** the org filter is still unresolved, so no bucket has been queried yet */
  pending: boolean;
  onSelectOrgLogin: (orgLogin: string | undefined) => void;
  onSelectPr: (pr: PrSummary) => void;
}

export function PrsScreen({
  orgs,
  selectedOrgLogin,
  prsByBucket,
  pending,
  onSelectOrgLogin,
  onSelectPr,
}: PrsScreenProps): ReactNode {
  return (
    <Screen title="Pull requests">
      <ResourceView resource={orgs}>
        {(orgList) =>
          orgList.length === 0 ? (
            <VStack className="gap-m md:max-w-[560px]">
              <InfoMessage>
                No organization yet. Install reviewflow on a github organization
                to see your pull requests here.
              </InfoMessage>
              <HStack>
                <ExternalLinkButton
                  href={installUrl}
                  text={`Install ${reviewflowName}`}
                />
              </HStack>
            </VStack>
          ) : (
            <VStack className="gap-l">
              <PrsOrgFilter
                orgs={orgList}
                selectedOrgLogin={selectedOrgLogin}
                onSelectOrgLogin={onSelectOrgLogin}
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
          )
        }
      </ResourceView>
    </Screen>
  );
}
