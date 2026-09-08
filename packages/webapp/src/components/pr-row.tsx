import {
  AccentScope,
  ExternalLink,
  ExternalLinkText,
  HStack,
  InteractiveBox,
  Text,
  VStack,
} from "alouette";
import type { ExternalOpenLinkBehavior } from "alouette";
import { Fragment } from "react";
import type { ReactNode } from "react";
import type {
  PrChangesSummary,
  PrChecksSummary,
  PrSummary,
  PrUserSummary,
} from "reviewflow-modules";
import { selectPrOwners, splitFailedCheckNames } from "reviewflow-modules";

const pluralize = (count: number, word: string): string =>
  `${count} ${word}${count > 1 ? "s" : ""}`;

const joinSegments = (segments: (string | undefined)[]): string =>
  segments.filter((segment) => segment !== undefined).join(" · ");

const formatChanges = ({
  changedFiles,
  additions,
  deletions,
}: PrChangesSummary): string =>
  `${pluralize(changedFiles, "file")} · +${additions} −${deletions}`;

const formatFailedNames = (failedNames: string[]): string => {
  const { names, remaining } = splitFailedCheckNames(failedNames);
  const listed = `${names.join(", ")}${remaining > 0 ? ` +${remaining}` : ""}`;
  return `${failedNames.length > 1 ? "checks" : "check"} failed: ${listed}`;
};

/**
 * A pull request without any check reports nothing, and a green one only where
 * the section it sits under does not already imply it.
 */
const formatChecks = (
  { conclusion, runningCount }: PrChecksSummary,
  showPassedChecks: boolean,
): string | undefined => {
  if (conclusion === "in-progress") {
    return `${pluralize(runningCount, "check")} running`;
  }
  if (conclusion === "passed" && showPassedChecks) return "checks passed";
  return undefined;
};

const formatLogins = (
  users: PrUserSummary[],
  currentUserLogin: string | undefined,
): string =>
  users
    .map(({ login }) => (login === currentUserLogin ? "you" : `@${login}`))
    .join(", ");

/**
 * Someone else's pull request requests a review, your own waits for one, so the
 * section the row sits in decides the verb.
 */
export type ReviewRequestVerb = "awaiting" | "requested";

const formatReviewRequests = (
  { requestedReviewers, requestedTeams }: PrSummary,
  verb: ReviewRequestVerb,
  currentUserLogin: string | undefined,
): string | undefined => {
  const awaited = [
    ...requestedReviewers.map(({ login }) =>
      login === currentUserLogin ? "you" : `@${login}`,
    ),
    ...requestedTeams.map((team) => `#${team}`),
  ];
  return awaited.length === 0 ? undefined : `${verb} ${awaited.join(", ")}`;
};

/** the same wording the slack home uses, so both surfaces read alike */
const formatFlowDate = ({
  approvedAt,
  openedAt,
}: PrSummary): string | undefined => {
  const date = approvedAt ?? openedAt;
  if (!date) return undefined;

  return `${approvedAt ? "approved" : "opened"} ${date.toLocaleDateString(
    "en-US",
    {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
    },
  )}`;
};

/** matches what ExternalLinkText does on its own */
const openLinkBehavior: ExternalOpenLinkBehavior = {
  native: "webBrowser",
  web: "targetBlank",
};

const separator = <Text className="font-body text-muted text-sm">·</Text>;

const metaSeparator = <Text className="text-muted text-xs">·</Text>;

interface PrRowStatusProps {
  /** what broke, in the danger accent */
  failed: string;
  /** who is blocking, in the warning accent */
  changesRequested: string | undefined;
  isDraft: boolean;
  /** everything the row states without raising an alarm */
  rest: string;
}

function PrRowStatus({
  failed,
  changesRequested,
  isDraft,
  rest,
}: PrRowStatusProps): ReactNode {
  if (!failed && !changesRequested && !isDraft && !rest) return null;

  const hasAlert = Boolean(failed || changesRequested);

  return (
    <HStack className="flex-wrap items-baseline gap-xs">
      {failed ? (
        <AccentScope accent="danger">
          <Text className="font-body-bold text-accent text-sm">{failed}</Text>
        </AccentScope>
      ) : null}

      {failed && changesRequested ? separator : null}

      {changesRequested ? (
        <AccentScope accent="warning">
          <Text className="font-body text-accent text-sm">
            {changesRequested}
          </Text>
        </AccentScope>
      ) : null}

      {hasAlert && (isDraft || rest) ? separator : null}

      {isDraft ? (
        <Text className="text-muted text-sm italic">draft</Text>
      ) : null}

      {isDraft && rest ? separator : null}

      {rest ? (
        <Text className="font-body text-muted text-sm">{rest}</Text>
      ) : null}
    </HStack>
  );
}

interface PrRowProps {
  pr: PrSummary;
  /** the Drafts section already says it */
  showDraft?: boolean;
  /** irrelevant where the section is about something other than the checks */
  showPassedChecks?: boolean;
  reviewRequestVerb?: ReviewRequestVerb;
  /** rendered as `you` rather than as one more login */
  currentUserLogin?: string;
}

export function PrRow({
  pr,
  showDraft = true,
  showPassedChecks = true,
  reviewRequestVerb = "awaiting",
  currentUserLogin,
}: PrRowProps): ReactNode {
  const failed = joinSegments([
    pr.checks.failedNames.length > 0
      ? formatFailedNames(pr.checks.failedNames)
      : undefined,
    pr.lintFailed ? "pr lint failed" : undefined,
  ]);

  const changesRequested =
    pr.changesRequestedBy.length > 0
      ? `changes requested by ${formatLogins(pr.changesRequestedBy, currentUserLogin)}`
      : undefined;

  const rest = joinSegments([
    formatChecks(pr.checks, showPassedChecks),
    pr.approvedBy.length > 0
      ? `approved by ${formatLogins(pr.approvedBy, currentUserLogin)}`
      : undefined,
    formatReviewRequests(pr, reviewRequestVerb, currentUserLogin),
  ]);

  const links = pr.statusLinks.filter(({ type }) => type === "success");
  const flowDate = formatFlowDate(pr);
  const owners = selectPrOwners(pr, { currentUserLogin });

  return (
    <VStack className="gap-xxs">
      <HStack className="flex-wrap items-center gap-xs">
        <Text className="font-mono text-xs text-muted">
          {`${pr.orgLogin}/${pr.repoName}#${pr.number}`}
        </Text>

        {links.map((link) => (
          <Fragment key={link.name}>
            {metaSeparator}
            <ExternalLinkText
              size="sm"
              href={link.url}
              text={link.label}
              // the whole row opens github, so the link must keep the press
              onPress={(event) => {
                event.stopPropagation();
              }}
            />
          </Fragment>
        ))}

        {pr.changes ? (
          <>
            {metaSeparator}
            <ExternalLink
              as={InteractiveBox}
              href={`${pr.url}/files`}
              openLinkBehavior={openLinkBehavior}
              role="link"
              // the whole row opens github, so the link must keep the press
              onPress={(event) => {
                event.stopPropagation();
              }}
            >
              <Text className="text-xs text-muted italic underline">
                {formatChanges(pr.changes)}
              </Text>
            </ExternalLink>
          </>
        ) : null}

        {flowDate ? (
          <>
            {metaSeparator}
            <Text className="text-xs text-muted">{flowDate}</Text>
          </>
        ) : null}
      </HStack>

      <HStack className="flex-wrap items-baseline gap-xs">
        <Text className="font-body-bold">{pr.title}</Text>
        {owners ? (
          <Text className="text-muted text-sm">{owners.label}</Text>
        ) : null}
      </HStack>

      <PrRowStatus
        failed={failed}
        changesRequested={changesRequested}
        isDraft={showDraft && pr.isDraft}
        rest={rest}
      />
    </VStack>
  );
}
