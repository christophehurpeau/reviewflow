import { IconButton, Text, View } from "alouette";
import { ArrowLeftRegularIcon } from "alouette-icons/phosphor-icons/ArrowLeft";
import type { ReactNode } from "react";
import { LiveUpdatesPausedNotice } from "#/components/live-updates-paused-notice.tsx";
import { PageContainer } from "#/components/page-container.tsx";

interface ScreenProps {
  title: string;
  backLabel?: string;
  onBack?: () => void;
  actions?: ReactNode;
  /** a query of the screen could not subscribe, its data will not update by itself */
  isLiveUpdatesPaused?: boolean;
  children: ReactNode;
}

export function Screen({
  title,
  backLabel = "Back",
  onBack,
  actions,
  isLiveUpdatesPaused = false,
  children,
}: ScreenProps): ReactNode {
  return (
    <PageContainer className="gap-l py-l">
      <View className="gap-xs">
        <View className="flex-row gap-m items-center">
          {onBack ? (
            <IconButton
              icon={<ArrowLeftRegularIcon />}
              size="sm"
              aria-label={backLabel}
              onPress={onBack}
            />
          ) : null}
          {title ? (
            <Text className="font-heading-extrabold text-3xl xl:text-4xl">
              {title}
            </Text>
          ) : null}
        </View>
        {actions}
      </View>
      <LiveUpdatesPausedNotice isPaused={isLiveUpdatesPaused} />
      {children}
    </PageContainer>
  );
}
