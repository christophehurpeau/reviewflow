import { errorToMessage } from "@reviewflow/ui";
import { useQueryClient } from "@tanstack/react-query";
import {
  ActionButton,
  Code,
  DecisionBar,
  ErrorMessage,
  InfoMessage,
  LinkText,
  Modal,
  RadioCard,
  RadioCardGroup,
  Text,
  View,
} from "alouette";
import { Link } from "expo-router";
import type { ReactNode } from "react";
import { useId, useState } from "react";
import { cloneRepository, useRepos } from "./reposApi.ts";

const targetOf = (folder: string, repo: string): string =>
  `${folder.replace(/\/+$/, "")}/${repo}`;

interface CloneRepositoryModalProps {
  ownerRepo: string;
  visible: boolean;
  onClose: () => void;
}

/**
 * Clones the repository into one of the repositories folders (`repoPaths`),
 * the first one chosen until the user picks another. Locked while the clone
 * runs: it goes on without the dialog, so closing it would only hide it.
 */
export function CloneRepositoryModal({
  ownerRepo,
  visible,
  onClose,
}: CloneRepositoryModalProps): ReactNode {
  const client = useQueryClient();
  const repos = useRepos();
  const [picked, setPicked] = useState<string | null>(null);
  const [cloning, setCloning] = useState(false);
  const folderLabelId = useId();
  const repoPaths = repos.data?.repoPaths ?? [];
  const folder =
    picked !== null && repoPaths.includes(picked)
      ? picked
      : (repoPaths[0] ?? null);
  const repo = ownerRepo.split("/")[1] ?? ownerRepo;

  const close = (): void => {
    if (!cloning) onClose();
  };

  const clone = async (): Promise<void> => {
    if (folder === null) return;
    setCloning(true);
    try {
      await cloneRepository(client, { ownerRepo, folder });
      onClose();
    } finally {
      setCloning(false);
    }
  };

  const noFolderReason = ((): string | null => {
    if (folder !== null) return null;
    if (repos.isPending) return "Reading the repositories folders…";
    return "No repositories folder is configured";
  })();

  return (
    <Modal
      visible={visible}
      title={`Clone ${ownerRepo}`}
      size="md"
      footer={
        <DecisionBar
          dismissDisabled={cloning}
          primary={
            <ActionButton
              text={cloning ? "Cloning…" : "Clone"}
              disabledReason={noFolderReason}
              errorMessageVariant="flat"
              errorToMessage={errorToMessage}
              onPress={clone}
            />
          }
          onDismiss={close}
        />
      }
      onClose={close}
    >
      <View className="gap-m">
        <Text className="text-sm text-muted">
          {"Cloned with "}
          <Code className="text-sm">gh repo clone</Code>, over your gh login:
          its diff is then read from the clone.
        </Text>
        {repos.error === null ? null : (
          <ErrorMessage>{repos.error.message}</ErrorMessage>
        )}
        {repos.data !== undefined && repoPaths.length === 0 ? (
          <InfoMessage>
            <Text className="text-sm">
              {"No repositories folder is configured: add one in "}
              <Link asChild href="/settings">
                <LinkText text="Settings" size="sm" />
              </Link>
              .
            </Text>
          </InfoMessage>
        ) : null}
        {repoPaths.length === 0 ? null : (
          <View className="gap-xs">
            <Text
              nativeID={folderLabelId}
              className="font-body-bold text-sm text-sharp"
            >
              Folder
            </Text>
            <RadioCardGroup
              aria-labelledby={folderLabelId}
              variant="outlined"
              value={folder ?? undefined}
              disabled={cloning}
              onValueChange={setPicked}
            >
              {repoPaths.map((path) => (
                <RadioCard
                  key={path}
                  value={path}
                  label={path}
                  description={`into ${targetOf(path, repo)}`}
                />
              ))}
            </RadioCardGroup>
          </View>
        )}
      </View>
    </Modal>
  );
}
