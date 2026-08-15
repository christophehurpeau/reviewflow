import { HStack, IconButton, Text, VStack } from "alouette";
import { ArrowLeftRegularIcon } from "alouette-icons/phosphor-icons/ArrowLeftRegularIcon";
import type { ReactNode } from "react";
import { PageContainer } from "#/components/page-container.tsx";

interface ScreenProps {
  title: string;
  backLabel?: string;
  onBack?: () => void;
  actions?: ReactNode;
  children: ReactNode;
}

export function Screen({
  title,
  backLabel = "Back",
  onBack,
  actions,
  children,
}: ScreenProps): ReactNode {
  return (
    <PageContainer className="gap-l py-l">
      <VStack className="gap-xs">
        <HStack className="gap-m items-center">
          {onBack ? (
            <IconButton
              icon={<ArrowLeftRegularIcon />}
              variant="contained"
              size="sm"
              aria-label="Back to settings"
              onPress={onBack}
            />
          ) : null}
          {title ? (
            <Text className="font-heading-extrabold text-3xl xl:text-4xl">
              {title}
            </Text>
          ) : null}
        </HStack>
        {actions}
      </VStack>
      {children}
    </PageContainer>
  );
}
