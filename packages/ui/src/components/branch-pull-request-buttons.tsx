import type { BranchPullRequest } from "@reviewflow/sdk";
import { Button } from "alouette";
import { GitMergeRegularIcon } from "alouette-icons/phosphor-icons/GitMerge";
import { GitPullRequestRegularIcon } from "alouette-icons/phosphor-icons/GitPullRequest";
import type { ReactNode } from "react";
import { usePrStatusAccent } from "../prStatus.ts";

interface BranchPullRequestButtonProps {
  pullRequest: BranchPullRequest;
  onOpen: (number: number) => void;
}

function BranchPullRequestButton({
  pullRequest,
  onOpen,
}: BranchPullRequestButtonProps): ReactNode {
  const mergedAccent = usePrStatusAccent("merged");
  const closedAccent = usePrStatusAccent("closed");
  const number = `#${String(pullRequest.number)}`;
  const label = `Open pull request ${number}: ${pullRequest.title}`;
  const open = (): void => {
    onOpen(pullRequest.number);
  };

  if (pullRequest.state === "MERGED") {
    return (
      <Button
        text={`${number} merged`}
        icon={<GitMergeRegularIcon />}
        accent={mergedAccent}
        variant="tonal"
        size="sm"
        role="link"
        aria-label={`${label} (merged)`}
        onPress={open}
      />
    );
  }
  if (pullRequest.state === "CLOSED") {
    return (
      <Button
        text={`${number} closed`}
        icon={<GitPullRequestRegularIcon />}
        accent={closedAccent}
        variant="tonal"
        size="sm"
        role="link"
        aria-label={`${label} (closed)`}
        onPress={open}
      />
    );
  }
  return (
    <Button
      text={number}
      icon={<GitPullRequestRegularIcon />}
      accent={pullRequest.isDraft ? "neutral" : "success"}
      variant="tonal"
      size="sm"
      role="link"
      aria-label={label}
      onPress={open}
    />
  );
}

export interface BranchPullRequestButtonsProps {
  /** the branch's own, open, merged or closed, as `GET /api/repos/branch-pulls` lists them */
  pullRequests: BranchPullRequest[];
  onOpen: (number: number) => void;
}

/**
 * One button per pull request of a branch, for a header's row of actions. The
 * merged accent is the app's `prStatusAccents` slot when a
 * `PullRequestSlotsProvider` gives one.
 */
export function BranchPullRequestButtons({
  pullRequests,
  onOpen,
}: BranchPullRequestButtonsProps): ReactNode {
  return pullRequests.map((pullRequest) => (
    <BranchPullRequestButton
      key={pullRequest.number}
      pullRequest={pullRequest}
      onOpen={onOpen}
    />
  ));
}
