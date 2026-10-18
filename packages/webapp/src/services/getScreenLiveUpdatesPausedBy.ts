import type { ResourceResult } from "react-liwi";
import type { LiveUpdatesPausedBy } from "reviewflow-modules";
import { getLiveUpdatesPausedBy } from "reviewflow-modules";

type AnyResourceResult = ResourceResult<any, any>;

/** the user's own limit wins: closing pages is something they can do */
export const getScreenLiveUpdatesPausedBy = (
  resources: readonly AnyResourceResult[],
): LiveUpdatesPausedBy | undefined => {
  const pausedBy = resources
    .filter((resource) => resource.fetched)
    .map((resource) => getLiveUpdatesPausedBy(resource.meta));
  if (pausedBy.includes("userLimit")) return "userLimit";
  if (pausedBy.includes("serverLimit")) return "serverLimit";
  return undefined;
};
