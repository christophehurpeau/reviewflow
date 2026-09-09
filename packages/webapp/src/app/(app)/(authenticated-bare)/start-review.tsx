import { useLocalSearchParams } from "expo-router";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { useTransportClientIsReady } from "react-liwi";
import { StartReviewScreen } from "#/sections/prs/StartReviewScreen.tsx";
import { useReviewflowServices } from "#/services/ReviewflowServicesProvider.tsx";

/** web only, as the pull request links of the prs screen are */
const leaveFor = (url: string): void => {
  globalThis.location.replace(url);
};

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

  useEffect(() => {
    if (!prId) {
      setError(new Error("This link carries no pull request"));
      return;
    }
    if (!isReady) return;

    let cancelled = false;
    prsService.operations.startReview({ prId }).then(
      ({ prUrl }) => {
        // replaced rather than pushed: going back must not start it again
        if (!cancelled) leaveFor(prUrl);
      },
      (error: unknown) => {
        if (!cancelled) setError(error);
      },
    );

    return () => {
      cancelled = true;
    };
  }, [isReady, prId, prsService]);

  return <StartReviewScreen error={error} />;
}
