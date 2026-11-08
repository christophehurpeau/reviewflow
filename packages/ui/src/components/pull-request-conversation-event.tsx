import type { PullRequestEvent } from "@reviewflow/sdk";
import type { IconProps } from "alouette";
import { Code, Icon, Text, View } from "alouette";
import { ArrowsClockwiseRegularIcon } from "alouette-icons/phosphor-icons/ArrowsClockwise";
import { CheckCircleRegularIcon } from "alouette-icons/phosphor-icons/CheckCircle";
import { CircleDashedRegularIcon } from "alouette-icons/phosphor-icons/CircleDashed";
import { EyeRegularIcon } from "alouette-icons/phosphor-icons/Eye";
import { FileDashedRegularIcon } from "alouette-icons/phosphor-icons/FileDashed";
import { GitBranchRegularIcon } from "alouette-icons/phosphor-icons/GitBranch";
import { GitCommitRegularIcon } from "alouette-icons/phosphor-icons/GitCommit";
import { GitMergeRegularIcon } from "alouette-icons/phosphor-icons/GitMerge";
import { LightningRegularIcon } from "alouette-icons/phosphor-icons/Lightning";
import { PencilSimpleRegularIcon } from "alouette-icons/phosphor-icons/PencilSimple";
import { ProhibitRegularIcon } from "alouette-icons/phosphor-icons/Prohibit";
import { TagRegularIcon } from "alouette-icons/phosphor-icons/Tag";
import { UserMinusRegularIcon } from "alouette-icons/phosphor-icons/UserMinus";
import { UserPlusRegularIcon } from "alouette-icons/phosphor-icons/UserPlus";
import { XCircleRegularIcon } from "alouette-icons/phosphor-icons/XCircle";
import type { ReactNode } from "react";
import { formatDataAge } from "../services/formatDataAge.ts";
import { LabelPill } from "./label-pill.tsx";

interface EventRowProps {
  icon: IconProps["icon"];
  event: PullRequestEvent;
  /** the words before the subject */
  text: string;
  /** the thing the action names; a string is set bold */
  subject?: ReactNode;
  /** the words after it */
  after?: string;
  /** a second thing after `after`, e.g. the new base branch */
  children?: ReactNode;
}

function EventRow({
  icon,
  event,
  text,
  subject,
  after,
  children,
}: EventRowProps): ReactNode {
  return (
    <View className="min-w-0 flex-row flex-wrap items-center gap-xs pl-xs">
      <Icon icon={icon} size={16} className="text-muted" />
      <Text className="text-sm font-body-bold">
        {event.actor?.login ?? "ghost"}
      </Text>
      <Text className="text-sm text-muted">{text}</Text>
      {typeof subject === "string" ? (
        <Text className="text-sm font-body-bold">{subject}</Text>
      ) : (
        subject
      )}
      {after === undefined ? null : (
        <Text className="text-sm text-muted">{after}</Text>
      )}
      {children}
      <Text className="text-sm text-muted">
        {formatDataAge(event.createdAt)}
      </Text>
    </View>
  );
}

/** Events about the branches and the pull request's own state. */
function BranchEventLine({ event }: { event: PullRequestEvent }): ReactNode {
  const { action, subject, detail } = event;
  if (action === "baseRefChanged") {
    return (
      <EventRow
        icon={<GitBranchRegularIcon />}
        event={event}
        text="changed the base branch from"
        subject={<Code>{detail ?? ""}</Code>}
        after="to"
      >
        <Code>{subject ?? ""}</Code>
      </EventRow>
    );
  }
  if (action === "headRefForcePushed") {
    return (
      <EventRow
        icon={<ArrowsClockwiseRegularIcon />}
        event={event}
        text="force-pushed the head branch"
        subject={detail === null ? undefined : <Code>{detail}</Code>}
      />
    );
  }
  if (action === "merged") {
    return (
      <EventRow
        icon={<GitMergeRegularIcon />}
        event={event}
        text="merged this pull request"
        subject={subject ?? undefined}
      />
    );
  }
  if (action === "closed") {
    return (
      <EventRow
        icon={<XCircleRegularIcon />}
        event={event}
        text="closed this pull request"
      />
    );
  }
  if (action === "reopened") {
    return (
      <EventRow
        icon={<CircleDashedRegularIcon />}
        event={event}
        text="reopened this pull request"
      />
    );
  }
  if (action === "reviewDismissed") {
    return (
      <EventRow
        icon={<ProhibitRegularIcon />}
        event={event}
        text="dismissed a review"
      />
    );
  }
  if (action === "autoMergeEnabled" || action === "autoMergeDisabled") {
    return (
      <EventRow
        icon={<LightningRegularIcon />}
        event={event}
        text={
          action === "autoMergeEnabled"
            ? "enabled auto-merge"
            : "disabled auto-merge"
        }
      />
    );
  }
  return (
    <EventRow
      icon={<GitCommitRegularIcon />}
      event={event}
      text="added a commit"
      subject={subject ?? undefined}
    />
  );
}

/** One event of the pull request, in GitHub's wording. */
export function EventLine({ event }: { event: PullRequestEvent }): ReactNode {
  const { action, subject, detail, label } = event;
  if (action === "reviewRequested") {
    return (
      <EventRow
        icon={<EyeRegularIcon />}
        event={event}
        text="requested a review from"
        subject={subject ?? undefined}
      />
    );
  }
  if (action === "reviewRequestRemoved") {
    return (
      <EventRow
        icon={<EyeRegularIcon />}
        event={event}
        text="removed the review request for"
        subject={subject ?? undefined}
      />
    );
  }
  if (action === "readyForReview") {
    return (
      <EventRow
        icon={<CheckCircleRegularIcon />}
        event={event}
        text="marked this pull request as ready for review"
      />
    );
  }
  if (action === "convertedToDraft") {
    return (
      <EventRow
        icon={<FileDashedRegularIcon />}
        event={event}
        text="marked this pull request as draft"
      />
    );
  }
  if (action === "labeled" || action === "unlabeled") {
    return (
      <EventRow
        icon={<TagRegularIcon />}
        event={event}
        text={action === "labeled" ? "added the" : "removed the"}
        subject={
          label === null ? (subject ?? undefined) : <LabelPill label={label} />
        }
        after="label"
      />
    );
  }
  if (action === "assigned" || action === "unassigned") {
    return (
      <EventRow
        icon={
          action === "assigned" ? (
            <UserPlusRegularIcon />
          ) : (
            <UserMinusRegularIcon />
          )
        }
        event={event}
        text={action}
        subject={subject ?? undefined}
      />
    );
  }
  if (action === "renamed") {
    return (
      <EventRow
        icon={<PencilSimpleRegularIcon />}
        event={event}
        text="changed the title"
        subject={`${detail ?? ""} → ${subject ?? ""}`}
      />
    );
  }
  return <BranchEventLine event={event} />;
}

/** Consecutive commits of one actor: a line for the push, then each headline. */
export function CommitsLine({
  events,
}: {
  events: PullRequestEvent[];
}): ReactNode {
  const [first] = events;
  if (first === undefined) return null;
  const count = events.length;
  return (
    <View className="min-w-0 gap-xxs">
      <EventRow
        icon={<GitCommitRegularIcon />}
        event={first}
        text="added"
        subject={String(count)}
        after={count === 1 ? "commit" : "commits"}
      />
      {events.map((event, index) => (
        <View
          key={`${event.detail ?? ""}:${String(index)}`}
          className="min-w-0 flex-row items-center gap-xs pl-xl"
        >
          <Text className="min-w-0 shrink text-sm" numberOfLines={1}>
            {event.subject ?? ""}
          </Text>
          {event.detail === null ? null : <Code>{event.detail}</Code>}
        </View>
      ))}
    </View>
  );
}
