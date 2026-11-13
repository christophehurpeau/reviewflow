import type { PrStatus } from "@reviewflow/sdk";
import { prStatusLabels } from "@reviewflow/sdk";
import { Badge, Code, Text, View } from "alouette";
import type { ReactNode } from "react";
import { usePrStatusAccent } from "../prStatus.ts";

/** Badge aligns itself to the start: in a row, that is the top, not the center. */
export function CenteredBadge({
  children,
}: {
  children: ReactNode;
}): ReactNode {
  return <View className="justify-center">{children}</View>;
}

function StatusBadge({ status }: { status: PrStatus }): ReactNode {
  return (
    <CenteredBadge>
      <Badge accent={usePrStatusAccent(status)}>{prStatusLabels[status]}</Badge>
    </CenteredBadge>
  );
}

interface MergeLineProps {
  /** null when the source does not know enough to say */
  status: PrStatus | null;
  author: string | null;
  baseRef: string | null;
  headRef: string | null;
  /** what follows the branches: sizes and age, which only GitHub's read has */
  children?: ReactNode;
}

/**
 * The status badge, then whose branch goes where. It wraps rather than
 * truncates, so it holds in a column as narrow as a side panel.
 */
export function MergeLine({
  status,
  author,
  baseRef,
  headRef,
  children,
}: MergeLineProps): ReactNode {
  return (
    <View className="flex-row flex-wrap items-center gap-xs">
      {status === null ? null : <StatusBadge status={status} />}
      <Text className="text-sm font-body-bold">
        {author ?? "unknown author"}
      </Text>
      {baseRef === null || headRef === null ? null : (
        <>
          <Text className="text-xs text-muted">
            {status === "merged" ? "merged into" : "wants to merge into"}
          </Text>
          <Code className="text-sm">{baseRef}</Code>
          <Text className="text-xs text-muted">from</Text>
          <Code className="text-sm">{headRef}</Code>
        </>
      )}
      {children}
    </View>
  );
}
