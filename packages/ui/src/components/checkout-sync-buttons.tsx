import type { CheckoutStatus } from "@reviewflow/sdk";
import { pullRefusal, pushRefusal } from "@reviewflow/sdk";
import { ActionButton } from "alouette";
import { CloudArrowDownRegularIcon } from "alouette-icons/phosphor-icons/CloudArrowDown";
import { CloudArrowUpRegularIcon } from "alouette-icons/phosphor-icons/CloudArrowUp";
import type { ReactNode } from "react";
import { errorToMessage } from "../services/errorToMessage.ts";

export interface CheckoutSyncButtonsProps {
  status: CheckoutStatus;
  hasOrigin: boolean;
  /** what the user calls this checkout, so each label names one of several */
  name: string;
  onPull: () => Promise<void>;
  onPush: () => Promise<void>;
  /** after every press, succeeded or not: git state moved either way, or may have */
  onDone: () => void;
}

/**
 * Pull and Push appear only when `pullRefusal` / `pushRefusal` would not refuse
 * them — the server asks the same question before running git, so a button is
 * never offered for a press the server turns down on its own terms. A failure
 * is git's reason, shown under the button.
 */
export function CheckoutSyncButtons({
  status,
  hasOrigin,
  name,
  onPull,
  onPush,
  onDone,
}: CheckoutSyncButtonsProps): ReactNode {
  const run = async (action: () => Promise<void>): Promise<void> => {
    try {
      await action();
    } finally {
      onDone();
    }
  };

  return (
    <>
      {pullRefusal(status) === null ? (
        <ActionButton
          text={`Pull ${String(status.behind)}`}
          icon={<CloudArrowDownRegularIcon />}
          accent="brand"
          variant="tonal"
          size="sm"
          aria-label={`Pull ${name}`}
          errorMessageVariant="flat"
          errorToMessage={errorToMessage}
          onPress={() => run(onPull)}
        />
      ) : null}
      {pushRefusal(status, hasOrigin) === null ? (
        <ActionButton
          text={
            status.upstream === null
              ? "Publish"
              : `Push ${String(status.ahead)}`
          }
          icon={<CloudArrowUpRegularIcon />}
          accent="brand"
          variant="tonal"
          size="sm"
          aria-label={`Push ${name}`}
          errorMessageVariant="flat"
          errorToMessage={errorToMessage}
          onPress={() => run(onPush)}
        />
      ) : null}
    </>
  );
}
