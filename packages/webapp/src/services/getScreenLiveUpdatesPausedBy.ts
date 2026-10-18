import type { ResourceResult } from "react-liwi";
import type { LiveUpdatesPausedBy } from "reviewflow-modules";
import { getLiveUpdatesPausedBy } from "reviewflow-modules";

type AnyResourceResult = ResourceResult<any, any>;

/**
 * What lasts comes first: an account not enabled is for the admin to change,
 * then the user's own limit, which closing pages fixes.
 */
const pausedByPriority: LiveUpdatesPausedBy[] = [
  "notEnabled",
  "userLimit",
  "serverLimit",
];

export const getScreenLiveUpdatesPausedBy = (
  resources: readonly AnyResourceResult[],
): LiveUpdatesPausedBy | undefined => {
  const pausedBy = resources
    .filter((resource) => resource.fetched)
    .map((resource) => getLiveUpdatesPausedBy(resource.meta));
  return pausedByPriority.find((reason) => pausedBy.includes(reason));
};
