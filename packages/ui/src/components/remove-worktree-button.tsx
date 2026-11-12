import type {
  LocalOnlyIgnored,
  WorktreeRemovalResult,
  WorktreeRemovalStatus,
} from "@reviewflow/sdk";
import { pluralOf, worktreeRemovalRefusals } from "@reviewflow/sdk";
import {
  Button,
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

const visibleIgnored = 10;

interface IgnoredEntryProps {
  entry: LocalOnlyIgnored;
}

/**
 * Each path is prefixed `./` because a bare `~/…` (an agent writing to an
 * unexpanded home path) reads as the home directory.
 */
function IgnoredEntry({ entry }: IgnoredEntryProps): ReactNode {
  if (entry.kind === "file") return <Code>{`./${entry.path}`}</Code>;
  if (entry.kind === "directory") {
    return (
      <View className="flex-row flex-wrap items-center gap-xs">
        <Code>{`./${entry.path}/`}</Code>
        <Text className="text-sm text-muted">
          {pluralOf(entry.files, "file")}
        </Text>
      </View>
    );
  }
  return (
    <View className="flex-row flex-wrap items-center gap-xs">
      <Code>{`./${entry.path}/`}</Code>
      <Text className="text-sm text-muted">
        dependencies or build output, not read
      </Text>
    </View>
  );
}

export interface IgnoredFilesProps {
  entries: LocalOnlyIgnored[];
}

/** Not a guard: an ignored file is usually disposable, so the reader decides. */
export function IgnoredFiles({ entries }: IgnoredFilesProps): ReactNode {
  if (entries.length === 0) return null;
  const hidden = entries.length - visibleIgnored;
  return (
    <View className="gap-xxs">
      <WarningMessage variant="flat">
        Lost with the worktree: ignored by git, so not counted as uncommitted,
        real files and not symlinks, and the main checkout has no copy. Move
        them out first if you need them.
      </WarningMessage>
      {entries.slice(0, visibleIgnored).map((entry) => (
        <IgnoredEntry key={entry.path} entry={entry} />
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
      <IgnoredFiles entries={check.status.localOnlyIgnored} />
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

/**
 * A host that can end the processes running inside the worktree itself offers
 * it as a box under the refusals, with its own wording.
 */
export interface CloseProcessesOption {
  label: string;
  /** under the box, like the branch box's */
  details?: string;
}

/** What the confirmation asked for beyond the branch; only passed with a `closeProcessesOption`. */
export interface RemoveWorktreeOptions {
  /** the host ends the processes inside before its server reads the refusals again */
  closeProcesses: boolean;
}

export interface RemoveWorktreeButtonProps {
  /** named before git answers anything */
  path: string;
  /** read on every opening: an answer kept from the last one could let a changed worktree through */
  readCheck: () => Promise<WorktreeRemovalCheck>;
  /**
   * runs the removal; the server reads every refusal again first. `options`
   * is passed only with a `closeProcessesOption`.
   */
  onRemove: (
    deleteBranch: boolean,
    options?: RemoveWorktreeOptions,
  ) => Promise<WorktreeRemovalResult>;
  /** after the removal, the branch's refusal included */
  onRemoved: (result: WorktreeRemovalResult) => void;
  /** why the button cannot be pressed at all */
  disabledReason?: string | null;
  /** a removal of this worktree is running: the button says so and cannot be pressed */
  pending?: boolean;
  /** the button's label; "Remove" unless set */
  text?: string;
  /** the button's label while `pending`; "Removing…" unless set */
  pendingText?: string;
  /** "Remove this worktree?" unless set */
  title?: string;
  /** the dialog's confirm button; "Remove" unless set */
  confirmText?: string;
  /**
   * The sentence under the title, e.g. naming what else the removal does;
   * inline content only, as it renders in the dialog's description `Text`.
   */
  description?: ReactNode;
  /**
   * Offers to end the processes inside, unchecked, when the read counts any:
   * checked, they no longer disable the confirm button, every other refusal
   * still does, and the server's own refusal shows in place. None unless set.
   */
  closeProcessesOption?: CloseProcessesOption;
}

const defaultDescription =
  "Its directory is deleted from disk. git refuses on its own if a file changed since this check.";

/**
 * Removes a worktree after a confirmation that reads what it would lose.
 * Its confirm button stays disabled until that read proves no uncommitted file, no commit
 * only here, no lock and no process inside; an unread or failed read disables
 * it too, since nothing is proven. A host's `closeProcessesOption` lifts the
 * process one alone, once checked. A `WarningAlertDialog`: one of the buttons
 * deletes files, and the icon says so before the copy is read.
 */
export function RemoveWorktreeButton({
  path,
  readCheck,
  onRemove,
  onRemoved,
  disabledReason = null,
  pending = false,
  text = "Remove",
  pendingText = "Removing…",
  title = "Remove this worktree?",
  confirmText = "Remove",
  description = defaultDescription,
  closeProcessesOption,
}: RemoveWorktreeButtonProps): ReactNode {
  const [confirming, setConfirming] = useState(false);
  const [read, setRead] = useState<CheckState>(unread);
  const [pickedDeleteBranch, setPickedDeleteBranch] = useState<boolean | null>(
    null,
  );
  const [pickedCloseProcesses, setPickedCloseProcesses] = useState(false);
  // an answer to an earlier opening must not land in this one
  const opening = useRef(0);
  const { check } = read;
  const branch = check?.status.branch ?? null;
  const deleteBranch =
    pickedDeleteBranch ?? (branch !== null && check?.branchSpent === true);
  const offersCloseProcesses =
    closeProcessesOption !== undefined &&
    (check?.status.processesInside ?? 0) > 0;
  const closeProcesses = offersCloseProcesses && pickedCloseProcesses;
  // the host ends them before its server reads the status again, so only the other refusals count here
  const removable =
    check !== null &&
    worktreeRemovalRefusals(
      closeProcesses ? { ...check.status, processesInside: 0 } : check.status,
    ).length === 0;

  const open = (): void => {
    opening.current += 1;
    const current = opening.current;
    setConfirming(true);
    setRead(unread);
    setPickedDeleteBranch(null);
    setPickedCloseProcesses(false);
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
          {`Could not read the worktree: ${read.error}. ${confirmText} stays disabled until it can be.`}
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
      <Button
        text={pending ? pendingText : text}
        icon={<TrashRegularIcon />}
        size="sm"
        variant="tonal"
        accent="danger"
        aria-label={`${pending ? pendingText : text}: ${path}`}
        disabledReason={pending ? pendingText : disabledReason}
        onPress={open}
      />
      <WarningAlertDialog
        visible={confirming}
        title={title}
        confirmText={confirmText}
        primaryAction="cancel"
        confirmDisabled={!removable}
        errorToMessage={errorToMessage}
        content={
          <View className="gap-sm">
            <Code>{path}</Code>
            {body}
            {offersCloseProcesses ? (
              <View className="gap-xxs">
                <Checkbox
                  label={closeProcessesOption.label}
                  checked={pickedCloseProcesses}
                  onValueChange={setPickedCloseProcesses}
                />
                {closeProcessesOption.details === undefined ? null : (
                  <Text className="text-sm text-muted">
                    {closeProcessesOption.details}
                  </Text>
                )}
              </View>
            ) : null}
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
          const result = await (closeProcessesOption === undefined
            ? onRemove(deleteBranch)
            : onRemove(deleteBranch, { closeProcesses }));
          close();
          onRemoved(result);
        }}
        onCancel={close}
      >
        {description}
      </WarningAlertDialog>
    </>
  );
}
