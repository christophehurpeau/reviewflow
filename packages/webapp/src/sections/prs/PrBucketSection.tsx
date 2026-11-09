import type {
  PrFilters,
  PrSummary,
  QueryMyPrsParams,
  ReviewRequestVerb,
} from "@reviewflow/modules";
import { matchesPrFilters } from "@reviewflow/modules";
import { PressableListItem, Text, View } from "alouette";
import type { Accent, SVGIconElement } from "alouette";
import type { ReactNode } from "react";
import type { ResourceResult } from "react-liwi";
import { ListSection } from "#/components/list-section.tsx";
import { PrRow } from "#/components/pr-row.tsx";
import { ResourceView } from "#/components/resource-view.tsx";
import { SkeletonList } from "#/components/skeleton.tsx";

export type PrBucketResource = ResourceResult<PrSummary[], QueryMyPrsParams>;

/**
 * A bucket is only worth a section while it can still show something: rows, a
 * skeleton or an error. An empty bucket leaves the page instead of stating it
 * is empty.
 */
export const hasBucketContent = (
  prs: PrBucketResource,
  pending: boolean,
  filters: PrFilters = {},
): boolean => {
  if (pending || !prs.fetched) return true;
  return (
    prs.error !== undefined ||
    prs.data.some((pr) => matchesPrFilters(pr, filters))
  );
};

interface PrBucketSectionProps {
  title: string;
  icon: SVGIconElement;
  accent?: Accent;
  prs: PrBucketResource;
  pending?: boolean;
  filters?: PrFilters;
  /** off where the section title already states it */
  showDraft?: boolean;
  /** off where the section is about something other than the checks */
  showPassedChecks?: boolean;
  /**
   * Whether the reviewers asked again join the ones awaited; off where the
   * section title already says every row in it was asked again.
   */
  showReRequests?: boolean;
  reviewRequestVerb?: ReviewRequestVerb;
  currentUserLogin?: string;
  onSelectPr: (pr: PrSummary) => void;
  /** the section's own control on each row, if it has one */
  renderAction?: (pr: PrSummary) => ReactNode;
}

interface TruncatedCountProps {
  prs: PrBucketResource;
  shown: number;
}

/** the query caps its rows: without the total, a capped bucket reads as complete */
function TruncatedCount({ prs, shown }: TruncatedCountProps): ReactNode {
  if (!prs.fetched) return null;
  const total = prs.meta.total;
  if (total <= shown) return null;

  return (
    <Text className="mt-xs text-muted text-sm">
      {`Showing ${shown} of ${total}`}
    </Text>
  );
}

export function PrBucketSection({
  title,
  icon,
  accent,
  prs,
  pending = false,
  filters = {},
  showDraft,
  showPassedChecks,
  showReRequests,
  reviewRequestVerb,
  currentUserLogin,
  onSelectPr,
  renderAction,
}: PrBucketSectionProps): ReactNode {
  if (!hasBucketContent(prs, pending, filters)) return null;

  return (
    <ListSection title={title} icon={icon} accent={accent}>
      <ResourceView
        resource={prs}
        pending={pending}
        loading={<SkeletonList rows={2} />}
      >
        {(prList) => {
          const shownPrs = prList.filter((pr) => matchesPrFilters(pr, filters));

          return (
            <View>
              <View role="list" className="gap-xs">
                {shownPrs.map((pr) => (
                  <PressableListItem
                    key={pr._id}
                    // a button row would nest the action's button inside it
                    role="listitem"
                    aria-label={`Open ${pr.orgLogin}/${pr.repoName}#${pr.number} ${pr.title}`}
                    actions={renderAction?.(pr)}
                    onPress={() => {
                      onSelectPr(pr);
                    }}
                  >
                    <PrRow
                      pr={pr}
                      showDraft={showDraft}
                      showPassedChecks={showPassedChecks}
                      showReRequests={showReRequests}
                      reviewRequestVerb={reviewRequestVerb}
                      currentUserLogin={currentUserLogin}
                    />
                  </PressableListItem>
                ))}
              </View>
              <TruncatedCount prs={prs} shown={shownPrs.length} />
            </View>
          );
        }}
      </ResourceView>
    </ListSection>
  );
}
