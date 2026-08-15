import {
  BreakpointNameEnum,
  HStack,
  VStack,
  useCurrentBreakpointName,
} from "alouette";
import { Children, type ReactNode } from "react";

const distributeRoundRobin = (
  items: ReactNode[],
  columnCount: number,
): ReactNode[][] =>
  Array.from({ length: columnCount }, (_, columnIndex) =>
    items.filter((_item, index) => index % columnCount === columnIndex),
  );

interface ColumnsProps {
  /** Columns used from the wide breakpoint (1280px) up; one column below it. */
  columnCount?: number;
  children: ReactNode;
}

/**
 * Sections of uneven height side by side, ordered left to right so the most
 * important one stays first.
 */
export function Columns({
  columnCount = 2,
  children,
}: ColumnsProps): ReactNode {
  const breakpoint = useCurrentBreakpointName();
  const items = Children.toArray(children);
  const columns =
    breakpoint === BreakpointNameEnum.WIDE && items.length > 1
      ? distributeRoundRobin(items, Math.min(columnCount, items.length))
      : [items];

  return (
    <HStack className="items-start gap-l">
      {columns.map((columnItems, index) => (
        <VStack key={`column-${index}`} className="flex-1 gap-l">
          {columnItems}
        </VStack>
      ))}
    </HStack>
  );
}
