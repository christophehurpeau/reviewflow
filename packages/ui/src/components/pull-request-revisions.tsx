import type {
  PullRequestRef,
  PullRequestRevision,
  PullRequestTextLine,
} from "@reviewflow/sdk";
import { pluralOf } from "@reviewflow/sdk";
import {
  Box,
  Button,
  ExternalLinkText,
  LinkText,
  Modal,
  Text,
  Tooltip,
  View,
} from "alouette";
import type { ReactNode } from "react";
import { useState } from "react";
import { usePullRequestDataSource } from "../dataSource.ts";
import { formatDataAge } from "../services/formatDataAge.ts";
import { linkInRow } from "./link-in-row.ts";
import { MarkdownText } from "./markdown-text.tsx";
import { PersonAvatar } from "./pull-request-conversation-person.tsx";
import { PullRequestPartPending } from "./pull-request-part-notice.tsx";

/** Unchanged lines kept on each side of a change; the rest fold into a count. */
const contextKept = 3;

type ChangeRun =
  | { kind: "folded"; count: number; from: number }
  | { kind: PullRequestTextLine["kind"]; text: string; from: number };

/** The marker is in the text, so the meaning survives without the colour. */
const linePrefix = (kind: PullRequestTextLine["kind"]): string => {
  if (kind === "added") return "+ ";
  if (kind === "removed") return "- ";
  return "  ";
};

const toRuns = (changes: PullRequestTextLine[]): ChangeRun[] => {
  const groups: {
    kind: PullRequestTextLine["kind"];
    lines: string[];
    from: number;
  }[] = [];
  for (const [at, line] of changes.entries()) {
    const open = groups.at(-1);
    if (open?.kind === line.kind) {
      open.lines.push(line.text);
      continue;
    }
    groups.push({ kind: line.kind, lines: [line.text], from: at });
  }

  const textOf = (kind: PullRequestTextLine["kind"], lines: string[]): string =>
    lines.map((line) => linePrefix(kind) + line).join("\n");

  return groups.flatMap((group, index): ChangeRun[] => {
    const { kind, lines, from } = group;
    if (kind !== "context") return [{ kind, text: textOf(kind, lines), from }];
    const head = index === 0 ? 0 : contextKept;
    const tail = index === groups.length - 1 ? 0 : contextKept;
    if (lines.length <= head + tail + 1) {
      return [{ kind, text: textOf(kind, lines), from }];
    }
    const runs: ChangeRun[] = [];
    if (head > 0) {
      runs.push({ kind, text: textOf(kind, lines.slice(0, head)), from });
    }
    runs.push({
      kind: "folded",
      count: lines.length - head - tail,
      from: from + head,
    });
    if (tail > 0) {
      runs.push({
        kind,
        text: textOf(kind, lines.slice(-tail)),
        from: from + lines.length - tail,
      });
    }
    return runs;
  });
};

function ChangeRunText({ run }: { run: ChangeRun }): ReactNode {
  if (run.kind === "folded") {
    return (
      <Text className="py-xxs text-xs text-muted">
        {`⋯ ${pluralOf(run.count, "unchanged line")}`}
      </Text>
    );
  }
  if (run.kind === "added") {
    return (
      <Text
        accent="success"
        className="select-auto font-mono text-xs text-accent web:whitespace-pre-wrap"
      >
        {run.text}
      </Text>
    );
  }
  if (run.kind === "removed") {
    return (
      <Text
        accent="danger"
        className="select-auto font-mono text-xs text-accent web:whitespace-pre-wrap"
      >
        {run.text}
      </Text>
    );
  }
  return (
    <Text className="select-auto font-mono text-xs text-sharp web:whitespace-pre-wrap">
      {run.text}
    </Text>
  );
}

/** Wrapped rather than scrolled: a description is prose, one paragraph a line. */
function ChangesBlock({
  changes,
}: {
  changes: PullRequestTextLine[];
}): ReactNode {
  return (
    <Box className="surface surface-sm lowered">
      {toRuns(changes).map((run) => (
        <ChangeRunText key={run.from} run={run} />
      ))}
    </Box>
  );
}

function RevisionContent({
  revision,
}: {
  revision: PullRequestRevision;
}): ReactNode {
  if (revision.body === null) {
    return (
      <Text className="text-sm text-muted">
        {`Deleted from the history by ${revision.deletedBy ?? "ghost"}.`}
      </Text>
    );
  }
  if (revision.changes !== null) {
    return <ChangesBlock changes={revision.changes} />;
  }
  if (revision.body.trim() === "") {
    return <Text className="text-sm text-muted">Empty.</Text>;
  }
  return <MarkdownText github text={revision.body} />;
}

function RevisionView({
  revision,
}: {
  revision: PullRequestRevision;
}): ReactNode {
  return (
    <View className="gap-xs">
      <View className="flex-row flex-wrap items-center gap-xs">
        <PersonAvatar person={revision.editor} />
        <Text className="text-sm font-body-bold">
          {revision.editor?.login ?? "ghost"}
        </Text>
        <Text className="text-sm text-muted">
          {`${revision.original ? "created" : "edited"} ${formatDataAge(revision.editedAt)}`}
        </Text>
      </View>
      <RevisionContent revision={revision} />
    </View>
  );
}

interface RevisionListProps {
  pullRequest: PullRequestRef;
  subjectId: string;
  url: string;
}

function RevisionList({
  pullRequest,
  subjectId,
  url,
}: RevisionListProps): ReactNode {
  const { value: revisions, error } = usePullRequestDataSource().useRevisions(
    pullRequest,
    subjectId,
  );
  if (revisions === null) {
    return <PullRequestPartPending error={error} what="the edit history" />;
  }
  const unlisted = revisions.revisionsTotal - revisions.revisions.length;
  return (
    <View className="gap-l">
      {revisions.revisions.map((revision, index) => (
        <RevisionView
          key={`${revision.editedAt}:${String(index)}`}
          revision={revision}
        />
      ))}
      {unlisted > 0 ? (
        <ExternalLinkText
          size="sm"
          href={url}
          text={`${String(unlisted)} older ${unlisted === 1 ? "revision is" : "revisions are"} only on GitHub`}
        />
      ) : null}
    </View>
  );
}

interface EditedLinkProps {
  pullRequest: PullRequestRef;
  /** the node id of the description, comment or review */
  subjectId: string;
  lastEditedAt: string | null;
  /** where GitHub shows it, for the revisions past the first page */
  url: string;
}

/**
 * GitHub's "edited" beside a date: nothing when the text was never edited,
 * else a link opening its history, read from GitHub only once opened.
 */
export function EditedLink({
  pullRequest,
  subjectId,
  lastEditedAt,
  url,
}: EditedLinkProps): ReactNode {
  const [open, setOpen] = useState(false);
  if (lastEditedAt === null) return null;
  const close = (): void => {
    setOpen(false);
  };
  return (
    <>
      <Tooltip
        content={`Edited ${formatDataAge(lastEditedAt)} — show the history`}
        render={(triggerProps) => (
          <LinkText
            {...triggerProps}
            size="sm"
            accent="neutral"
            text="edited"
            className={linkInRow}
            onPress={() => {
              setOpen(true);
            }}
          />
        )}
      />
      <Modal
        visible={open}
        size="lg"
        title="Edit history"
        footer={<Button text="Close" onPress={close} />}
        onClose={close}
      >
        {open ? (
          <RevisionList
            pullRequest={pullRequest}
            subjectId={subjectId}
            url={url}
          />
        ) : null}
      </Modal>
    </>
  );
}
