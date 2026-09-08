import { Icon, Text, VStack } from "alouette";
import { ConfettiRegularIcon } from "alouette-icons/phosphor-icons/ConfettiRegularIcon";
import type { ReactNode } from "react";

export function PrsEmptyState(): ReactNode {
  return (
    <VStack className="items-center gap-sm py-xl">
      <Icon icon={<ConfettiRegularIcon />} size={48} className="text-muted" />
      <Text className="text-center font-heading-bold text-lg">
        It looks like you don&apos;t have any PR to review!
      </Text>
      <Text className="text-center font-body text-muted">
        Nothing is waiting for you, and none of your pull requests are in
        progress.
      </Text>
    </VStack>
  );
}
