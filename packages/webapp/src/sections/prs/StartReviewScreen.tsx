import { ErrorMessage, Text, VStack, View } from "alouette";
import type { ReactNode } from "react";
import { errorToMessage } from "#/errorToMessage.ts";

interface StartReviewScreenProps {
  /** the screen only ever waits or fails: on success it navigates to github */
  error: unknown;
}

/**
 * A staging screen, reached from a link rather than opened on purpose: it starts
 * the review and hands the reviewer over to github. It carries no shell, so it
 * says what it is doing rather than leaving a bare page behind.
 */
export function StartReviewScreen({
  error,
}: StartReviewScreenProps): ReactNode {
  return (
    <VStack className="min-h-screen items-center justify-center bg-screen p-l">
      {error === undefined ? (
        <VStack
          className="items-center gap-m"
          role="status"
          aria-label="Redirecting to the pull request"
        >
          <View className="h-[10px] w-[240px] animate-pulse rounded-sm bg-lowered" />
          <Text className="font-body text-muted">
            Redirecting to the pull request…
          </Text>
        </VStack>
      ) : (
        <VStack className="w-full max-w-[480px] gap-m">
          <Text className="font-heading-extrabold text-2xl">
            Could not start the review
          </Text>
          <ErrorMessage>{errorToMessage(error)}</ErrorMessage>
        </VStack>
      )}
    </VStack>
  );
}
