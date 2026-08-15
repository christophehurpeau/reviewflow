import {
  ConfirmationMessage,
  ExternalLinkButton,
  InfoMessage,
  Text,
  VStack,
  WarningMessage,
} from "alouette";
import type { ReactNode } from "react";
import type { OrgSlackStatus } from "reviewflow-modules";
import { serverUrl } from "#/services/serverUrl.ts";

interface SlackConnectionCardProps {
  orgId: number;
  orgLogin: string;
  slack: OrgSlackStatus;
}

export function SlackConnectionCard({
  orgId,
  orgLogin,
  slack,
}: SlackConnectionCardProps): ReactNode {
  const query = `orgId=${encodeURIComponent(orgId)}&orgLogin=${encodeURIComponent(orgLogin)}`;

  return (
    <VStack className="gap-m">
      {slack.usesDeprecatedCustomApp ? (
        <WarningMessage variant="flat">
          This account uses a custom slack application.
        </WarningMessage>
      ) : null}

      {slack.state === "app-not-installed" ? (
        <>
          <InfoMessage variant="flat">
            No slack workspace linked yet. Install the application to get
            notifications for your reviews.
          </InfoMessage>
          <ExternalLinkButton
            href={serverUrl(`/app/slack-install?${query}`)}
            text="Add to Slack"
          />
        </>
      ) : null}

      {slack.state === "user-not-linked" ? (
        <>
          <InfoMessage variant="flat">
            {`Slack team ${slack.teamName ?? slack.teamId ?? ""} is linked, but your account is not. Sign in to get notifications for your reviews.`}
          </InfoMessage>
          <ExternalLinkButton
            href={serverUrl(`/app/slack-connect?${query}`)}
            text="Sign in with Slack"
          />
        </>
      ) : null}

      {slack.state === "linked" ? (
        <>
          <ConfirmationMessage variant="flat">
            {`Linked to slack team ${slack.teamName ?? slack.teamId ?? ""}.`}
          </ConfirmationMessage>
          <Text className="font-mono text-sm text-muted">
            {`Slack user id: ${slack.userId ?? ""}`}
          </Text>
        </>
      ) : null}
    </VStack>
  );
}
