import { WarningMessage } from "alouette";
import type { ReactNode } from "react";

interface LiveUpdatesPausedNoticeProps {
  isPaused: boolean;
}

export function LiveUpdatesPausedNotice({
  isPaused,
}: LiveUpdatesPausedNoticeProps): ReactNode {
  if (!isPaused) return null;
  return (
    <WarningMessage>
      Due to high usage, live updates are paused: this page shows the data as of
      its opening.
    </WarningMessage>
  );
}
