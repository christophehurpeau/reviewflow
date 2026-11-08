import type {
  WorktreeRemovalResult,
  WorktreeRemovalStatus,
} from "@reviewflow/sdk";
import { worktreeRemovalRefusals } from "@reviewflow/sdk";
import {
  Checkbox,
  Code,
  ConfirmationMessage,
  Text,
  View,
  WarningAlertDialog,
  WarningMessage,
} from "alouette";
import { TrashRegularIcon } from "alouette-icons/phosphor-icons/Trash";
import type { ReactNode } from "react";
import { useRef, useState } from "react";
import { errorToMessage } from "../services/errorToMessage.ts";
import { TooltipIconButton } from "./tooltip-icon-button.tsx";

const visibleIgnored = 10;

export interface IgnoredFilesProps {
  paths: string[];
}

/**
 * Not a guard: an ignored file is usually disposable, so the reader decides.
 * Each path is prefixed `./` because a bare `~/…` (an agent writing to an
 * unexpanded home path) reads as the home directory.
 */
export function IgnoredFiles({ paths }: IgnoredFilesProps): ReactNode {
  if (paths.length === 0) return null;
  const hidden = paths.length - visibleIgnored;
  return (
    <View className="gap-xxs">
      <WarningMessage variant="flat">
        Lost with the worktree: ignored by git, so not counted as uncommitted,
        real files and not symlinks, and the main checkout has no copy. Move
        them out first if you need them.
      </WarningMessage>
      {paths.slice(0, visibleIgnored).map((path) => (
        <Code key={path}>{`./${path}`}</Code>
      ))}
      {hidden > 0 ? (
        <Text className="text-sm text-muted">{`and ${String(hidden)} more`}</Text>
      ) : null}
    </View>
  );
}

/** What a confirmation reads before it offers the removal. */
export interface WorktreeRemovalCheck {
  status: WorktreeRemovalStatus;
  /** the branch's work is demonstrably spent (a merged pull request): the branch box starts checked */
  branchSpent: boolean;
  /** under the refusals, e.g. why no pull request could prove a commit pushed */
  notice: string | null;
}

export interface WorktreeRemovalMessagesProps {
  check: WorktreeRemovalCheck;
}

/** Every refusal, or the all-clear; the notice; then the ignored files the removal takes. */
export function WorktreeRemovalMessages({
  check,
}: WorktreeRemovalMessagesProps): ReactNode {
  const refusals = worktreeRemovalRefusals(check.status);
  return (
    <>
      {refusals.map((refusal) => (
        <WarningMessage key={refusal} variant="flat">
          {refusal}
        </WarningMessage>
      ))}
      {refusals.length === 0 ? (
        <ConfirmationMessage variant="flat">
          No uncommitted file, every commit is on a remote branch or in a pull
          request, and nothing runs inside.
        </ConfirmationMessage>
      ) : null}
      {check.notice === null ? null : (
        <Text className="text-sm text-muted">{check.notice}</Text>
      )}
      <IgnoredFiles paths={check.status.localOnlyIgnored} />
    </>
  );
}

interface CheckState {
  check: WorktreeRemovalCheck | null;
  error: string | null;
}

const unread: CheckState = { check: null, error: null };

const branchDetails =
  "Only the local branch: git refuses while it is unmerged, and the remote is never touched.";

export interface RemoveWorktreeButtonProps {
  /** named before git answers anything */
  path: string;
  /** read on every opening: an answer kept from the last one could let a changed worktree through */
  readCheck: () => Promise<WorktreeRemovalCheck>;
  /** runs the removal; the server reads every refusal again first */
  onRemove: (deleteBranch: boolean) => Promise<WorktreeRemovalResult>;
  /** after the removal, the branch's refusal included */
  onRemoved: (result: WorktreeRemovalResult) => void;
  /** why the button cannot be pressed at all, e.g. a removal already running */
  disabledReason?: string | null;
}

/**
 * Removes a worktree after a confirmation that reads what it would lose.
 * Remove stays disabled until that read proves no uncommitted file, no commit
 * only here, no lock and no process inside; an unread or failed read disables
 * it too, since nothing is proven. A `WarningAlertDialog`: one of the buttons
 * deletes files, and the icon says so before the copy is read.
 */
export function RemoveWorktreeButton({
  path,
  readCheck,
  onRemove,
  onRemoved,
  disabledReason = null,
}: RemoveWorktreeButtonProps): ReactNode {
  const [confirming, setConfirming] = useState(false);
  const [read, setRead] = useState<CheckState>(unread);
  const [pickedDeleteBranch, setPickedDeleteBranch] = useState<boolean | null>(
    null,
  );
  // an answer to an earlier opening must not land in this one
  const opening = useRef(0);
  const { check } = read;
  const branch = check?.status.branch ?? null;
  const deleteBranch =
    pickedDeleteBranch ?? (branch !== null && check?.branchSpent === true);
  const removable =
    check !== null && worktreeRemovalRefusals(check.status).length === 0;

  const open = (): void => {
    opening.current += 1;
    const current = opening.current;
    setConfirming(true);
    setRead(unread);
    setPickedDeleteBranch(null);
    readCheck().then(
      (answer) => {
        if (opening.current === current) {
          setRead({ check: answer, error: null });
        }
      },
      (error: unknown) => {
        if (opening.current === current) {
          setRead({ check: null, error: errorToMessage(error) });
        }
      },
    );
  };

  const close = (): void => {
    opening.current += 1;
    setConfirming(false);
    setRead(unread);
  };

  const body = ((): ReactNode => {
    if (read.error !== null) {
      return (
        <WarningMessage variant="flat">
          {`Could not read the worktree: ${read.error}. Remove stays disabled until it can be.`}
        </WarningMessage>
      );
    }
    if (check === null) {
      return (
        <Text className="text-sm text-muted">
          Checking for uncommitted files, unpushed commits and processes inside…
        </Text>
      );
    }
    return <WorktreeRemovalMessages check={check} />;
  })();

  return (
    <>
      <TooltipIconButton
        icon={<TrashRegularIcon />}
        size="sm"
        variant="soft"
        accent="danger"
        aria-label={`Remove the worktree at ${path}`}
        disabledReason={disabledReason}
        onPress={open}
      />
      <WarningAlertDialog
        visible={confirming}
        title="Remove this worktree?"
        confirmText="Remove"
        primaryAction="cancel"
        confirmDisabled={!removable}
        errorToMessage={errorToMessage}
        content={
          <View className="gap-sm">
            <Code>{path}</Code>
            {body}
            {branch === null || check === null ? null : (
              <View className="gap-xxs">
                <Checkbox
                  label={`Also delete the branch ${branch}`}
                  checked={deleteBranch}
                  onValueChange={setPickedDeleteBranch}
                />
                <Text className="text-sm text-muted">{branchDetails}</Text>
              </View>
            )}
          </View>
        }
        onConfirm={async () => {
          const result = await onRemove(deleteBranch);
          close();
          onRemoved(result);
        }}
        onCancel={close}
      >
        Its directory is deleted from disk. git refuses on its own if a file
        changed since this check.
      </WarningAlertDialog>
    </>
  );
}
