import { ErrorMessage, VStack } from "alouette";
import type { QueryParams } from "liwi-resources-client";
import type { ReactNode } from "react";
import type { ResourceResult } from "react-liwi";
import { SkeletonList } from "./skeleton.tsx";

interface ResourceViewProps<Data, Params extends QueryParams<Params>> {
  resource: ResourceResult<Data, Params>;
  /**
   * A value the query depends on is still unresolved, so the query is skipped
   * and its state describes nothing that can be shown yet.
   */
  pending?: boolean;
  loading?: ReactNode;
  children: (data: Data) => ReactNode;
}

/**
 * Gates a resource so that nothing derived from its data — including empty
 * states and fallbacks — can render before the first fetch resolves.
 */
export function ResourceView<Data, Params extends QueryParams<Params>>({
  resource,
  pending = false,
  loading = <SkeletonList />,
  children,
}: ResourceViewProps<Data, Params>): ReactNode {
  if (pending || resource.initialLoading) return loading;
  if (!resource.fetched) {
    return <ErrorMessage>{resource.error.message}</ErrorMessage>;
  }
  if (!resource.error) return children(resource.data);

  return (
    <VStack className="gap-m">
      <ErrorMessage>{resource.error.message}</ErrorMessage>
      {children(resource.data)}
    </VStack>
  );
}
