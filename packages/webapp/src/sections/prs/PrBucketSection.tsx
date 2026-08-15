import { PressableListItem, Text, VStack } from "alouette";
import type { ReactNode } from "react";
import type { ResourceResult } from "react-liwi";
import type { PrSummary, QueryMyPrsParams } from "reviewflow-modules";
import { ListSection } from "#/components/list-section.tsx";
import { PrRow } from "#/components/pr-row.tsx";
import { ResourceView } from "#/components/resource-view.tsx";
import { SkeletonList } from "#/components/skeleton.tsx";

export type PrBucketResource = ResourceResult<PrSummary[], QueryMyPrsParams>;

interface PrBucketSectionProps {
  title: string;
  prs: PrBucketResource;
  pending?: boolean;
  onSelectPr: (pr: PrSummary) => void;
}

export function PrBucketSection({
  title,
  prs,
  pending,
  onSelectPr,
}: PrBucketSectionProps): ReactNode {
  return (
    <ListSection title={title}>
      <ResourceView
        resource={prs}
        pending={pending}
        loading={<SkeletonList rows={2} />}
      >
        {(prList) =>
          prList.length === 0 ? (
            <Text className="mx-xs font-body text-muted">Nothing here.</Text>
          ) : (
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
          )
        }
      </ResourceView>
    </ListSection>
  );
}
