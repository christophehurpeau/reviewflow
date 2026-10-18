import { WarningMessage } from "alouette";
import type { ReactNode } from "react";
import type { LiveUpdatesPausedBy } from "reviewflow-modules";
import { NotEnabledMessage } from "./not-enabled-message.tsx";

interface LiveUpdatesPausedNoticeProps {
  pausedBy: LiveUpdatesPausedBy | undefined;
}

export function LiveUpdatesPausedNotice({
  pausedBy,
}: LiveUpdatesPausedNoticeProps): ReactNode {
  if (pausedBy === "notEnabled") {
    return (
      <NotEnabledMessage>
        Live updates are not enabled for this account or organization: this page
        shows the data as of its opening.
      </NotEnabledMessage>
    );
  }
  if (pausedBy === "userLimit") {
    return (
      <WarningMessage>
        You have many reviewflow pages open, so live updates are paused on this
        one: it shows the data as of its opening. Close some of the others and
        open this page again to get them back.
      </WarningMessage>
    );
  }
  if (pausedBy === "serverLimit") {
    return (
      <WarningMessage>
        Due to high usage, live updates are paused: this page shows the data as
        of its opening.
      </WarningMessage>
    );
  }
  return null;
}
