import { useLocalSearchParams } from "expo-router";
import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import { useTransportClientIsReady } from "react-liwi";
import { StartReviewScreen } from "#/sections/prs/StartReviewScreen.tsx";
import { useReviewflowServices } from "#/services/ReviewflowServicesProvider.tsx";

/** web only, as the pull request links of the prs screen are */
const leaveFor = (url: string): void => {
  globalThis.location.replace(url);
};

interface StartReviewRun {
  cancelled: boolean;
}

/**
 * The slack home has no way to act as the reviewer — their github token lives in
 * this app's session and nowhere else — so its "Start the review" link lands
 * here, which starts the review and forwards to the pull request.
 */
export default function StartReviewPage(): ReactNode {
  const { prId } = useLocalSearchParams<{ prId?: string }>();
  const { prsService } = useReviewflowServices();
  const isReady = useTransportClientIsReady();
  const [error, setError] = useState<unknown>();
  const runRef = useRef<StartReviewRun>(undefined);

  useEffect(() => {
    if (!prId) {
      setError(new Error("This link carries no pull request"));
      return;
    }
    if (!isReady) return;
    // readiness follows the websocket, which reconnects on its own, so this
    // effect runs again long after the operation left. Starting a review
    // comments on the pull request: it is sent once and never again
    if (runRef.current) return;

    const run: StartReviewRun = { cancelled: false };
    runRef.current = run;

    prsService.operations.startReview({ prId }).then(
      ({ prUrl }) => {
        // replaced rather than pushed: going back must not start it again
        if (!run.cancelled) leaveFor(prUrl);
      },
      (error: unknown) => {
        if (!run.cancelled) setError(error);
      },
    );
  }, [isReady, prId, prsService]);

  // only leaving the screen cancels, never the effect running again: the send
  // outlives its own effect, and must still forward when it answers
  useEffect(
    () => () => {
      if (runRef.current) runRef.current.cancelled = true;
    },
    [],
  );

  return <StartReviewScreen error={error} />;
}
