import { PressableListItem, VStack } from "alouette";
import type { Accent, SVGIconElement } from "alouette";
import type { ReactNode } from "react";
import type { ResourceResult } from "react-liwi";
import type { PrSummary, QueryMyPrsParams } from "reviewflow-modules";
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
): boolean => {
  if (pending || !prs.fetched) return true;
  return prs.error !== undefined || prs.data.length > 0;
};

interface PrBucketSectionProps {
  title: string;
  icon: SVGIconElement;
  iconAccent?: Accent;
  prs: PrBucketResource;
  pending?: boolean;
  onSelectPr: (pr: PrSummary) => void;
}

export function PrBucketSection({
  title,
  icon,
  iconAccent,
  prs,
  pending = false,
  onSelectPr,
}: PrBucketSectionProps): ReactNode {
  if (!hasBucketContent(prs, pending)) return null;

  return (
    <ListSection title={title} icon={icon} iconAccent={iconAccent}>
      <ResourceView
        resource={prs}
        pending={pending}
        loading={<SkeletonList rows={2} />}
      >
        {(prList) => (
          <VStack>
            {prList.map((pr) => (
              <PressableListItem
                key={pr._id}
                onPress={() => {
                  onSelectPr(pr);
                }}
              >
                <PrRow pr={pr} />
              </PressableListItem>
            ))}
          </VStack>
        )}
      </ResourceView>
    </ListSection>
  );
}
