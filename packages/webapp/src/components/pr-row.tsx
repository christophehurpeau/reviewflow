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
  PrRowStatus,
  PrSummary,
  ReviewRequestVerb,
} from "reviewflow-modules";
import {
  formatPrChanges,
  formatPrFlowDate,
  selectPrOwners,
  selectPrRowStatus,
} from "reviewflow-modules";

/** matches what ExternalLinkText does on its own */
const openLinkBehavior: ExternalOpenLinkBehavior = {
  native: "webBrowser",
  web: "targetBlank",
};

const separator = <Text className="font-body text-muted text-sm">·</Text>;

const metaSeparator = <Text className="text-muted text-xs">·</Text>;

/** `failed` in the danger accent, `changesRequested` in the warning one */
function PrStatusLine({
  failed,
  changesRequested,
  isDraft,
  rest,
}: PrRowStatus): ReactNode {
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
  /**
   * Whether the reviewers asked again join the ones awaited; off where the
   * section title already says every row in it was asked again.
   */
  showReRequests?: boolean;
  reviewRequestVerb?: ReviewRequestVerb;
  /** rendered as `you` rather than as one more login */
  currentUserLogin?: string;
  /** the section's own control, pressed without opening the row */
  action?: ReactNode;
}

export function PrRow({
  pr,
  showDraft = true,
  showPassedChecks = true,
  showReRequests = true,
  reviewRequestVerb = "awaiting",
  currentUserLogin,
  action,
}: PrRowProps): ReactNode {
  const status = selectPrRowStatus(pr, {
    currentUserLogin,
    showDraft,
    showPassedChecks,
    showReRequests,
    reviewRequestVerb,
  });

  const links = pr.statusLinks.filter(({ type }) => type === "success");
  const flowDate = formatPrFlowDate(pr);
  const owners = selectPrOwners(pr, { currentUserLogin });

  return (
    <HStack className="items-start gap-sm">
      <VStack className="flex-1 gap-xxs">
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
                  {formatPrChanges(pr.changes)}
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

        <PrStatusLine {...status} />
      </VStack>

      {action}
    </HStack>
  );
}
