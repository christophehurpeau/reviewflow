import type { PullRequestSlots } from "@reviewflow/ui";
import {
  BranchPullRequestButtons,
  PullRequestSlotsProvider,
} from "@reviewflow/ui";
import { WarningMessage } from "alouette";
import { useRouter } from "expo-router";
import type { ReactNode } from "react";
import { mergedAccent } from "#/mergedAccent.ts";
import { rememberPullRequest } from "#/services/recentPullRequests.ts";
import { useBranchPulls } from "#/services/reposApi.ts";

const slots: PullRequestSlots = { prStatusAccents: { merged: mergedAccent } };

interface BranchPullRequestsProps {
  ownerRepo: string;
  /** null on a detached HEAD, or before the branch is known: nothing is read */
  branch: string | null;
}

/** The branch's pull requests, each opening its screen; nothing while they load. */
export function BranchPullRequests({
  ownerRepo,
  branch,
}: BranchPullRequestsProps): ReactNode {
  const router = useRouter();
  const { data } = useBranchPulls(ownerRepo, branch);
  if (data === undefined) return null;
  return (
    <PullRequestSlotsProvider value={slots}>
      <BranchPullRequestButtons
        pullRequests={data.pullRequests}
        onOpen={(number) => {
          rememberPullRequest({ ownerRepo, number });
          router.push({
            pathname: "/pull-request",
            params: { repo: ownerRepo, number: String(number) },
          });
        }}
      />
    </PullRequestSlotsProvider>
  );
}

/** GitHub failing only loses the pull request buttons, and says so. */
export function BranchPullRequestsNotice({
  ownerRepo,
  branch,
}: BranchPullRequestsProps): ReactNode {
  const { error } = useBranchPulls(ownerRepo, branch);
  if (error === null) return null;
  return (
    <WarningMessage>
      {`Could not read the branch's pull requests: ${error.message}`}
    </WarningMessage>
  );
}
