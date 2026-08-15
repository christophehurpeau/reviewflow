import { Badge, HStack, Text, VStack } from "alouette";
import type { Accent } from "alouette";
import type { ReactNode } from "react";
import type {
  PrChangesSummary,
  PrChecksSummary,
  PrSummary,
} from "reviewflow-modules";

const pluralize = (count: number, word: string): string =>
  `${count} ${word}${count > 1 ? "s" : ""}`;

interface ChecksBadgeContent {
  accent: Accent;
  text: string;
}

/** a pull request without any check reports nothing rather than an empty state badge */
const toChecksBadge = ({
  conclusion,
  failedCount,
  runningCount,
}: PrChecksSummary): ChecksBadgeContent | undefined => {
  if (conclusion === "failed") {
    return {
      accent: "danger",
      text: `${pluralize(failedCount, "check")} failed`,
    };
  }
  if (conclusion === "in-progress") {
    return {
      accent: "info",
      text: `${pluralize(runningCount, "check")} running`,
    };
  }
  if (conclusion === "passed") {
    return { accent: "success", text: "checks passed" };
  }
  return undefined;
};

const maxDisplayedFailedNames = 3;

const formatFailedNames = (failedNames: string[]): string => {
  const displayed = failedNames.slice(0, maxDisplayedFailedNames);
  const remaining = failedNames.length - displayed.length;
  return `failed: ${displayed.join(", ")}${remaining > 0 ? ` +${remaining}` : ""}`;
};

const formatChanges = ({
  changedFiles,
  additions,
  deletions,
}: PrChangesSummary): string =>
  `${pluralize(changedFiles, "file")} changed (+${additions} -${deletions})`;

interface PrRowProps {
  pr: PrSummary;
}

export function PrRow({ pr }: PrRowProps): ReactNode {
  const checksBadge = toChecksBadge(pr.checks);
  const details = [
    pr.checks.failedNames.length > 0
      ? formatFailedNames(pr.checks.failedNames)
      : undefined,
    pr.changes ? formatChanges(pr.changes) : undefined,
  ].filter(Boolean);

  return (
    <VStack className="gap-xs">
      <HStack className="items-baseline gap-sm">
        <Text className="font-mono text-sm text-muted">
          {`${pr.orgLogin}/${pr.repoName}#${pr.number}`}
        </Text>
        <Text className="flex-1 font-body-bold">{pr.title}</Text>
      </HStack>

      <HStack className="flex-wrap items-center gap-xs">
        {pr.isDraft ? <Badge variant="solid">draft</Badge> : null}

        {checksBadge ? (
          <Badge accent={checksBadge.accent}>{checksBadge.text}</Badge>
        ) : null}

        {pr.lintFailed ? <Badge accent="danger">lint failed</Badge> : null}

        {pr.changesRequestedCount > 0 ? (
          <Badge accent="danger">
            {`${pluralize(pr.changesRequestedCount, "change")} requested`}
          </Badge>
        ) : null}

        {pr.approvedCount > 0 ? (
          <Badge accent="success">{`${pr.approvedCount} approved`}</Badge>
        ) : null}

        {pr.requestedReviewers.map((reviewer) => (
          <Badge key={reviewer.id} variant="outlined">
            {`awaiting @${reviewer.login}`}
          </Badge>
        ))}

        {pr.requestedTeams.map((team) => (
          <Badge key={team} variant="outlined">
            {`awaiting #${team}`}
          </Badge>
        ))}
      </HStack>

      {details.length > 0 ? (
        <Text className="font-body text-sm text-muted">
          {details.join(" · ")}
        </Text>
      ) : null}
    </VStack>
  );
}
