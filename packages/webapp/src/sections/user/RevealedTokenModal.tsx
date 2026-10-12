import {
  ActionButton,
  Button,
  CodeBlock,
  Modal,
  View,
  WarningMessage,
} from "alouette";
import { CopyRegularIcon } from "alouette-icons/phosphor-icons/Copy";
import type { ReactNode } from "react";
// oxlint-disable-next-line import/extensions -- resolves clipboard.web.ts on web
import { copyToClipboard } from "#/clipboard";
import { errorToMessage } from "#/errorToMessage.ts";

interface RevealedTokenModalProps {
  /** shown while defined */
  token: string | undefined;
  onClose: () => void;
}

export function RevealedTokenModal({
  token,
  onClose,
}: RevealedTokenModalProps): ReactNode {
  return (
    <Modal
      visible={token !== undefined}
      title="Copy your new token"
      footer={<Button text="Done" onPress={onClose} />}
      onClose={onClose}
    >
      <View className="gap-m">
        <WarningMessage variant="flat">
          It will not be shown again. Store it now: a lost token can only be
          regenerated.
        </WarningMessage>
        <CodeBlock>{token}</CodeBlock>
        <View className="flex-row">
          <ActionButton
            text="Copy"
            icon={<CopyRegularIcon />}
            errorMessageVariant="flat"
            errorToMessage={errorToMessage}
            onPress={() => copyToClipboard(token ?? "")}
          />
        </View>
      </View>
    </Modal>
  );
}
