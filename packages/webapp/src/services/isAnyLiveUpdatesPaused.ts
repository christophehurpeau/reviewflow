import type { ResourceResult } from "react-liwi";
import { isLiveUpdatesPaused } from "reviewflow-modules";

type AnyResourceResult = ResourceResult<any, any>;

export const isAnyLiveUpdatesPaused = (
  resources: readonly AnyResourceResult[],
): boolean =>
  resources.some(
    (resource) => resource.fetched && isLiveUpdatesPaused(resource.meta),
  );
