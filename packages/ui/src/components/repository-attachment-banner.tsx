import { Text, View, WarningMessage } from "alouette";
import type { ReactNode } from "react";
import type { RepositoryAttachment } from "../dataSource.ts";
import { usePullRequestSlots } from "../slots.tsx";

interface RepositoryAttachmentBannerProps {
  ownerRepo: string;
  attachment: RepositoryAttachment;
  /** overrides the `renderRepositoryAction` slot: where the checkout is configured */
  action?: ReactNode;
}

/**
 * Says up front, on every tab, that the diff of this repository cannot be read
 * because no local checkout is attached to it, rather than leaving that to be
 * found in the Review tab. An entry that exists but fails its check shows why.
 * Nothing when the checkout is attached.
 */
export function RepositoryAttachmentBanner({
  ownerRepo,
  attachment,
  action,
}: RepositoryAttachmentBannerProps): ReactNode {
  const { renderRepositoryAction } = usePullRequestSlots();
  if (attachment.status === "attached") return null;
  const shownAction = action ?? renderRepositoryAction?.(ownerRepo);
  return (
    <WarningMessage>
      <View className="gap-xs">
        <Text className="font-body-bold text-sm">
          {`${ownerRepo} is not attached to a local checkout: the diff cannot be read.`}
        </Text>
        {attachment.status === "invalidPath" ? (
          <Text className="text-sm">{attachment.detail}</Text>
        ) : null}
        {shownAction === null || shownAction === undefined ? null : (
          <View className="flex-row">{shownAction}</View>
        )}
      </View>
    </WarningMessage>
  );
}
