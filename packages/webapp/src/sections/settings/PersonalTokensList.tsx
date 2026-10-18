import {
  Button,
  ExternalLinkText,
  FormField,
  FormValidationError,
  IconButton,
  InputText,
  Menu,
  MenuItem,
  Modal,
  Separator,
  SimpleVForm,
  Text,
  View,
  WarningAlertDialog,
} from "alouette";
import { ArrowsClockwiseRegularIcon } from "alouette-icons/phosphor-icons/ArrowsClockwise";
import { DotsThreeRegularIcon } from "alouette-icons/phosphor-icons/DotsThree";
import { PlusRegularIcon } from "alouette-icons/phosphor-icons/Plus";
import { TrashRegularIcon } from "alouette-icons/phosphor-icons/Trash";
import type { ReactNode } from "react";
import { Fragment, useState } from "react";
import type {
  CreatedPersonalToken,
  PersonalTokenSummary,
} from "reviewflow-modules";
import { NotEnabledMessage } from "#/components/not-enabled-message.tsx";
import { errorToMessage } from "#/errorToMessage.ts";
import { RevealedTokenModal } from "./RevealedTokenModal.tsx";

const maxNameLength = 100;

const apiDocUrl =
  "https://github.com/christophehurpeau/reviewflow/blob/main/docs/api.md";

const formatDate = (date: Date): string =>
  date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

const formatLastUse = ({
  lastUsedAt,
  lastUsedIp,
}: PersonalTokenSummary): string => {
  if (!lastUsedAt) return "never used";
  return lastUsedIp
    ? `last used ${formatDate(lastUsedAt)} from ${lastUsedIp}`
    : `last used ${formatDate(lastUsedAt)}`;
};

const submitErrorToMessage = (error: unknown): string =>
  error instanceof FormValidationError
    ? "Please fix the errors above."
    : errorToMessage(error);

const validateName = (name: string): string | undefined => {
  if (!name.trim()) return "A name is required.";
  if (name.trim().length > maxNameLength) {
    return `${maxNameLength} characters at most.`;
  }
  return undefined;
};

interface CreateTokenValues {
  name: string;
}

interface CreateTokenModalProps {
  visible: boolean;
  onClose: () => void;
  onCreate: (name: string) => Promise<void>;
}

function CreateTokenModal({
  visible,
  onClose,
  onCreate,
}: CreateTokenModalProps): ReactNode {
  return (
    <Modal visible={visible} title="New personal token" onClose={onClose}>
      <SimpleVForm<CreateTokenValues>
        defaultValues={{ name: "" }}
        submitLabel="Create"
        submitErrorToMessage={submitErrorToMessage}
        render={({ control }) => (
          <FormField
            required
            control={control}
            name="name"
            label="Name"
            validate={validateName}
            render={({ field, labelId, describedBy, invalid, required }) => (
              <InputText
                ref={field.ref}
                value={field.value}
                placeholder="vigie on MacBook"
                aria-labelledby={labelId}
                aria-describedby={describedBy}
                aria-required={required}
                invalid={invalid}
                onChangeText={field.onChange}
                onBlur={field.onBlur}
              />
            )}
          />
        )}
        onSubmit={({ name }) => onCreate(name.trim())}
      />
    </Modal>
  );
}

interface PersonalTokenRowProps {
  token: PersonalTokenSummary;
  onRegenerate: () => void;
  onRevoke: () => void;
}

function PersonalTokenRow({
  token,
  onRegenerate,
  onRevoke,
}: PersonalTokenRowProps): ReactNode {
  const actionsLabel = `Actions for ${token.name}`;
  return (
    <View className="flex-row items-center gap-m">
      <View className="flex-1 gap-xs">
        <Text className="font-body-bold">{token.name}</Text>
        <Text className="text-sm text-muted">
          <Text className="font-mono text-sm text-muted">{`${token.prefix}…`}</Text>
          {` · created ${formatDate(token.createdAt)} · ${formatLastUse(token)}`}
        </Text>
      </View>
      <Menu
        label={actionsLabel}
        render={(triggerProps) => (
          <IconButton
            variant="soft"
            icon={<DotsThreeRegularIcon />}
            aria-label={actionsLabel}
            {...triggerProps}
          />
        )}
      >
        <MenuItem
          label="Regenerate"
          icon={<ArrowsClockwiseRegularIcon />}
          onPress={onRegenerate}
        />
        <MenuItem
          label="Revoke"
          accent="danger"
          icon={<TrashRegularIcon />}
          onPress={onRevoke}
        />
      </Menu>
    </View>
  );
}

interface PendingAction {
  type: "regenerate" | "revoke";
  token: PersonalTokenSummary;
}

interface PersonalTokensListProps {
  tokens: PersonalTokenSummary[];
  /** false when none of the user's accounts has the API: creating a token is then pointless */
  isApiEnabled: boolean;
  onCreate: (name: string) => Promise<CreatedPersonalToken>;
  onRegenerate: (tokenId: string) => Promise<CreatedPersonalToken>;
  onRevoke: (tokenId: string) => Promise<void>;
}

export function PersonalTokensList({
  tokens,
  isApiEnabled,
  onCreate,
  onRegenerate,
  onRevoke,
}: PersonalTokensListProps): ReactNode {
  const [isCreating, setIsCreating] = useState(false);
  const [pendingAction, setPendingAction] = useState<PendingAction>();
  const [revealedToken, setRevealedToken] = useState<string>();

  const closePendingAction = (): void => {
    setPendingAction(undefined);
  };

  return (
    <View className="gap-l">
      <View className="gap-m">
        <Text className="text-muted">
          Read-only access for tools like vigie. A token reads what you can
          read: your account, and the organizations you belong to that allow
          personal tokens.
        </Text>
        <View className="flex-row">
          <ExternalLinkText href={apiDocUrl} text="API documentation" />
        </View>
        {isApiEnabled ? null : (
          <NotEnabledMessage>
            The API is not enabled for any of your accounts.
          </NotEnabledMessage>
        )}
        <View className="flex-row">
          <Button
            text="New token"
            icon={<PlusRegularIcon />}
            disabled={!isApiEnabled}
            onPress={() => {
              setIsCreating(true);
            }}
          />
        </View>
      </View>
      {tokens.length === 0 ? (
        <Text>No token yet.</Text>
      ) : (
        <View className="gap-m">
          {tokens.map((token, index) => (
            <Fragment key={token._id}>
              {index > 0 && <Separator />}
              <PersonalTokenRow
                token={token}
                onRegenerate={() => {
                  setPendingAction({ type: "regenerate", token });
                }}
                onRevoke={() => {
                  setPendingAction({ type: "revoke", token });
                }}
              />
            </Fragment>
          ))}
        </View>
      )}

      <CreateTokenModal
        visible={isCreating}
        onClose={() => {
          setIsCreating(false);
        }}
        onCreate={async (name) => {
          const created = await onCreate(name);
          setIsCreating(false);
          setRevealedToken(created.token);
        }}
      />
      <WarningAlertDialog
        primaryAction="cancel"
        visible={pendingAction?.type === "regenerate"}
        title="Regenerate token"
        confirmText="Regenerate"
        errorToMessage={errorToMessage}
        onCancel={closePendingAction}
        onConfirm={async () => {
          if (!pendingAction) return;
          const created = await onRegenerate(pendingAction.token._id);
          closePendingAction();
          setRevealedToken(created.token);
        }}
      >
        {`"${pendingAction?.token.name}" stops working immediately and is replaced by a new token.`}
      </WarningAlertDialog>
      <WarningAlertDialog
        primaryAction="cancel"
        visible={pendingAction?.type === "revoke"}
        title="Revoke token"
        confirmText="Revoke"
        errorToMessage={errorToMessage}
        onCancel={closePendingAction}
        onConfirm={async () => {
          if (!pendingAction) return;
          await onRevoke(pendingAction.token._id);
          closePendingAction();
        }}
      >
        {`"${pendingAction?.token.name}" stops working immediately.`}
      </WarningAlertDialog>
      <RevealedTokenModal
        token={revealedToken}
        onClose={() => {
          setRevealedToken(undefined);
        }}
      />
    </View>
  );
}
