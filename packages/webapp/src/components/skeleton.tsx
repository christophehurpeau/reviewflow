import { Box, View } from "alouette";
import type { ReactNode } from "react";

const skeletonBar = "animate-pulse rounded-sm bg-lowered";

const range = (length: number): number[] =>
  Array.from({ length }, (_, index) => index);

interface SkeletonListProps {
  rows?: number;
}

export function SkeletonList({ rows = 3 }: SkeletonListProps): ReactNode {
  return (
    <View className="gap-xs" role="status" aria-label="Loading">
      {range(rows).map((row) => (
        <View key={row} className={`${skeletonBar} mx-xs my-xxs h-[54px]`} />
      ))}
    </View>
  );
}

interface SkeletonSectionsProps {
  sections?: number;
}

export function SkeletonSections({
  sections = 3,
}: SkeletonSectionsProps): ReactNode {
  return (
    <View className="gap-l" role="status" aria-label="Loading">
      {range(sections).map((section) => (
        <Box key={section} className="surface surface-md gap-m">
          <View className={`${skeletonBar} h-[22px] w-2/5`} />
          <View className={`${skeletonBar} h-[16px] w-4/5`} />
          <View className={`${skeletonBar} h-[16px] w-3/5`} />
        </Box>
      ))}
    </View>
  );
}

export function SkeletonBlock(): ReactNode {
  return (
    <View className="gap-m" role="status" aria-label="Loading">
      <View className={`${skeletonBar} h-[48px]`} />
      <View className={`${skeletonBar} h-[44px] w-[220px]`} />
    </View>
  );
}
