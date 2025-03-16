import type { PullRequestWithDecentData } from "../../events/pr-handlers/utils/PullRequestData";

export const isPrFromRenovateBot = (pr: PullRequestWithDecentData) => {
  return (
    pr.head.ref.startsWith("renovate/") && pr.user.login === "renovate[bot]"
  );
};
