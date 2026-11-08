import type { PullRequestRef } from "@reviewflow/sdk";
import {
  Button,
  DecisionBar,
  ErrorMessage,
  InputText,
  Modal,
  View,
} from "alouette";
import type { ReactNode } from "react";
import { useState } from "react";
import { parsePullRequestInput } from "./parsePullRequestInput.ts";

interface OpenPullRequestModalProps {
  visible: boolean;
  onClose: () => void;
  onOpen: (ref: PullRequestRef) => void;
}

/**
 * Asks for a pull request as GitHub's url, `owner/repo#n` or `owner/repo/n`.
 * Enter submits and Escape closes (the modal's own); an input that is not a
 * pull request stays open with the reason under the field. The text is dropped
 * on close, so the next opening starts empty.
 */
export function OpenPullRequestModal({
  visible,
  onClose,
  onOpen,
}: OpenPullRequestModalProps): ReactNode {
  const [input, setInput] = useState("");
  const [invalid, setInvalid] = useState(false);

  const close = (): void => {
    setInput("");
    setInvalid(false);
    onClose();
  };

  const submit = (): void => {
    const ref = parsePullRequestInput(input);
    if (ref === null) {
      setInvalid(true);
      return;
    }
    setInput("");
    setInvalid(false);
    onOpen(ref);
  };

  return (
    <Modal
      visible={visible}
      title="Open a pull request"
      size="md"
      footer={
        <DecisionBar
          primary={
            <Button
              text="Open"
              accent="brand"
              disabled={input.trim() === ""}
              onPress={submit}
            />
          }
          onDismiss={close}
        />
      }
      onClose={close}
    >
      <View className="gap-xs">
        <InputText
          // oxlint-disable-next-line jsx-a11y/no-autofocus -- the modal opens from a press that asks for this field
          autoFocus
          mode="url"
          value={input}
          invalid={invalid}
          placeholder="https://github.com/owner/repo/pull/123, owner/repo#123 or owner/repo/123"
          aria-label="Pull request"
          onChangeText={(text) => {
            setInput(text);
            setInvalid(false);
          }}
          onSubmitEditing={submit}
        />
        {invalid ? (
          <ErrorMessage>
            Not a pull request: use a github.com pull request url,
            owner/repo#123 or owner/repo/123.
          </ErrorMessage>
        ) : null}
      </View>
    </Modal>
  );
}
