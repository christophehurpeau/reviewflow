import type { DiffImpactsResponse } from "@reviewflow/sdk";
import { AccentScope, Icon, Text, View } from "alouette";
import { InfoRegularIcon } from "alouette-icons/phosphor-icons/Info";
import { ShareNetworkDuotoneIcon } from "alouette-icons/phosphor-icons/ShareNetwork";
import type { ReactNode } from "react";
import type { ImpactsStatus } from "./pull-request-diff-impacts.ts";
import { countImpacts, pluralOf } from "./pull-request-diff-impacts.ts";

interface PullRequestDiffImpactsSummaryProps {
  /** null until read, or when it could not be */
  impacts: DiffImpactsResponse | null;
  status: ImpactsStatus;
}

/** Past this many, the files not analyzed are counted rather than named. */
const maxNotAnalyzedNames = 5;

const notAnalyzedFilesLine = (paths: readonly string[]): string =>
  paths.length > maxNotAnalyzedNames
    ? `${pluralOf(paths.length, "file")} not analyzed (not TypeScript, or deleted).`
    : `Not analyzed (not TypeScript, or deleted): ${paths.join(", ")}.`;

const notAnalyzedLines = (impacts: DiffImpactsResponse): string[] => {
  if (impacts.tooLarge) {
    return [
      impacts.reason === "files"
        ? "Impacts not analyzed: the repository is too large."
        : "Impacts not analyzed yet: reading the repository is taking long, trying again…",
    ];
  }
  return [
    ...(impacts.notAnalyzed.length === 0
      ? []
      : [notAnalyzedFilesLine(impacts.notAnalyzed)]),
    ...(impacts.unresolvedIn.length === 0
      ? []
      : [
          `Importers in ${impacts.unresolvedIn.join(", ")} not analyzed: some imports resolve to no file.`,
        ]),
  ];
};

/**
 * What the change's touched exports are used by outside the diff, and what
 * could not be analyzed. While reading or after a failure it says so: never a
 * count it does not know.
 */
export function PullRequestDiffImpactsSummary({
  impacts,
  status,
}: PullRequestDiffImpactsSummaryProps): ReactNode {
  if (impacts === null) {
    if (status === "reading") {
      return <Text className="text-xs text-muted">Reading the impacts…</Text>;
    }
    if (status === "failed") {
      return (
        <Text className="text-xs text-muted">
          The impacts could not be read.
        </Text>
      );
    }
    return null;
  }
  const lines = notAnalyzedLines(impacts);
  const counts = impacts.tooLarge ? null : countImpacts(impacts.files);
  return (
    <View className="gap-xs">
      {counts === null ? null : (
        <View className="flex-row items-start gap-xs">
          <AccentScope accent="info">
            <View className="pt-[2px]">
              <Icon
                icon={<ShareNetworkDuotoneIcon />}
                size={18}
                className="text-accent"
              />
            </View>
          </AccentScope>
          <Text className="shrink text-sm text-sharp">
            {counts.exports === 0
              ? "No touched export is used outside the diff."
              : `${pluralOf(counts.exports, "touched export")} used in ${pluralOf(counts.files, "file")}${counts.tests === 0 ? "" : `, ${pluralOf(counts.tests, "test")}`} outside the diff.`}
          </Text>
        </View>
      )}
      {lines.map((line) => (
        <View key={line} className="flex-row items-start gap-xs">
          <View className="pt-[1px]">
            <Icon icon={<InfoRegularIcon />} size={16} className="text-muted" />
          </View>
          <Text className="shrink text-xs text-muted">{line}</Text>
        </View>
      ))}
    </View>
  );
}
