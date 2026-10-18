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
      Live updates are paused because the server is busy. This page will not
      refresh by itself: reload it to see the latest data.
    </WarningMessage>
  );
}
