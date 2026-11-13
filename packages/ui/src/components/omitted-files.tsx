import type { DiffOmittedFile } from "@reviewflow/sdk";
import { Code, Text, View } from "alouette";
import type { ReactNode } from "react";

export const omissionLabel = (reason: DiffOmittedFile["reason"]): string => {
  if (reason === "binary") return "binary";
  if (reason === "tooLarge") return "too large";
  if (reason === "whitespace") return "only whitespace changed";
  return "over the diff budget";
};

interface OmittedFilesProps {
  omitted: DiffOmittedFile[];
}

/** The files a diff left out and why; nothing when it left none out. */
export function OmittedFiles({ omitted }: OmittedFilesProps): ReactNode {
  if (omitted.length === 0) return null;
  return (
    <View className="gap-xxs">
      <Text className="text-xs font-body-bold text-muted">
        {`Left out (${String(omitted.length)})`}
      </Text>
      {omitted.map(({ path, reason }) => (
        <View key={path} className="flex-row flex-wrap items-center gap-xs">
          <Code className="text-xs">{path}</Code>
          <Text className="text-xs text-muted">{omissionLabel(reason)}</Text>
        </View>
      ))}
    </View>
  );
}
