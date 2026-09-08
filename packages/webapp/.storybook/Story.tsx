import { ScreenScrollView, Text, VStack } from "alouette";
import type { ReactNode } from "react";

interface StoryProps {
  children: ReactNode;
}

interface StorySectionProps {
  title: string;
  children: ReactNode;
}

function StorySection({ title, children }: StorySectionProps): ReactNode {
  return (
    <VStack className="gap-xs">
      <Text className="mx-xs font-mono text-muted text-sm">{title}</Text>
      {children}
    </VStack>
  );
}

/** The frame a Variants story renders in: the screen background, one labelled block per variant. */
export function Story({ children }: StoryProps): ReactNode {
  return (
    <ScreenScrollView
      className="bg-screen"
      contentContainerClassName="gap-l p-l"
    >
      {children}
    </ScreenScrollView>
  );
}

Story.Section = StorySection;
