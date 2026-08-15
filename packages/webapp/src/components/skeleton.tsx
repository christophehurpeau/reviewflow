import { Surface, VStack, View } from "alouette";
import type { ReactNode } from "react";

const skeletonBar = "animate-pulse rounded-sm bg-lowered";

const range = (length: number): number[] =>
  Array.from({ length }, (_, index) => index);

interface SkeletonListProps {
  rows?: number;
}

export function SkeletonList({ rows = 3 }: SkeletonListProps): ReactNode {
  return (
    <VStack className="gap-xs" role="status" aria-label="Loading">
      {range(rows).map((row) => (
        <View key={row} className={`${skeletonBar} mx-xs my-xxs h-[54px]`} />
      ))}
    </VStack>
  );
}

interface SkeletonSectionsProps {
  sections?: number;
}

export function SkeletonSections({
  sections = 3,
}: SkeletonSectionsProps): ReactNode {
  return (
    <VStack className="gap-l" role="status" aria-label="Loading">
      {range(sections).map((section) => (
        <Surface key={section} size="md" className="gap-m">
          <View className={`${skeletonBar} h-[22px] w-2/5`} />
          <View className={`${skeletonBar} h-[16px] w-4/5`} />
          <View className={`${skeletonBar} h-[16px] w-3/5`} />
        </Surface>
      ))}
    </VStack>
  );
}

export function SkeletonBlock(): ReactNode {
  return (
    <VStack className="gap-m" role="status" aria-label="Loading">
      <View className={`${skeletonBar} h-[48px]`} />
      <View className={`${skeletonBar} h-[44px] w-[220px]`} />
    </VStack>
  );
}
