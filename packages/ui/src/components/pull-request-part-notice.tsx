import {
  IndeterminateCircularProgress,
  IndeterminateLinearProgress,
  Text,
  View,
  WarningMessage,
} from "alouette";
import type { ReactNode } from "react";
import { createContext, use, useCallback, useEffect, useState } from "react";

/** Marks one part as being read; returns how to unmark it. */
type ReportReading = () => () => void;

/**
 * Where the {@link PullRequestPartReading} below report to, for a single
 * progress bar at the top of the screen instead of one per tab.
 */
export const PartReadingScope = createContext<ReportReading | null>(null);

/** How many parts below a {@link PartReadingScope} given `report` are being read. */
export const usePartReadingCount = (): {
  count: number;
  report: ReportReading;
} => {
  const [count, setCount] = useState(0);
  const report = useCallback(() => {
    setCount((n) => n + 1);
    return () => {
      setCount((n) => n - 1);
    };
  }, []);
  return { count, report };
};

interface PullRequestPartPendingProps {
  error: string | null;
  /** what is read, as the sentence names it: "the timeline", "the checks" */
  what: string;
}

/** In place of a part GitHub has not answered yet: its failure, else the wait. */
export function PullRequestPartPending({
  error,
  what,
}: PullRequestPartPendingProps): ReactNode {
  if (error !== null) return <WarningMessage>{error}</WarningMessage>;
  return (
    <View className="flex-row items-center gap-xs py-sm">
      <IndeterminateCircularProgress loading size="xs" />
      <Text className="text-sm text-muted">{`Reading ${what} from GitHub…`}</Text>
    </View>
  );
}

/**
 * Above a part already shown — the daemon's last read, or an answer being
 * read again after an edit — while GitHub is read. Inside the screen, it is
 * shown by the screen's bar instead.
 */
export function PullRequestPartReading({
  reading,
}: {
  reading: boolean;
}): ReactNode {
  const report = use(PartReadingScope);
  useEffect(() => {
    if (!reading || report === null) return undefined;
    return report();
  }, [reading, report]);
  if (report !== null) return null;
  return <IndeterminateLinearProgress loading={reading} size="xs" />;
}

/** A failed read, above the last answer, which stays. */
export function PullRequestPartError({
  error,
}: {
  error: string | null;
}): ReactNode {
  if (error === null) return null;
  return <WarningMessage>{error}</WarningMessage>;
}
