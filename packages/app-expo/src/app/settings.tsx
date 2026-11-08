import type { ReviewflowConnectionStatus } from "@reviewflow/sdk";
import {
  defaultRepoPath,
  insertCheckoutEntry,
  readDefaultRepoPathSetting,
  writeDefaultRepoPathSetting,
} from "@reviewflow/sdk";
import {
  DiffSettingsSection,
  EditableFile,
  errorToMessage,
} from "@reviewflow/ui";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ActionButton,
  Badge,
  Box,
  Button,
  Code,
  ErrorMessage,
  FormEditableItem,
  FormField,
  FormItem,
  IconButton,
  InputPassword,
  InputText,
  ScreenScrollView,
  Text,
  View,
  WarningAlertDialog,
  WarningMessage,
} from "alouette";
import { ArrowLeftRegularIcon } from "alouette-icons/phosphor-icons/ArrowLeft";
import { useLocalSearchParams, useRouter } from "expo-router";
import type { ReactNode } from "react";
import { useState } from "react";
import { useDiffPreferences } from "#/services/DiffPreferencesProvider.tsx";
import { LiveIndicator } from "#/services/LiveIndicator.tsx";
import type { ConfigFile } from "#/services/configApi.ts";
import {
  configFileKey,
  readConfigFile,
  saveConfigFile,
} from "#/services/configApi.ts";
import {
  forgetToken,
  readStatus,
  saveToken,
  statusQueryKey,
} from "#/services/reviewflowApi.ts";

export const defaultReviewflowUrl = "https://reviewflow.chapplications.com";

function ConnectionStatus({
  status,
}: {
  status: ReviewflowConnectionStatus;
}): ReactNode {
  if (!status.configured) {
    return (
      <Text className="text-sm text-muted">
        No token is stored. Save one below to read your pull requests.
      </Text>
    );
  }
  return (
    <View className="gap-xxs">
      <Text className="text-sm">
        Server: <Code className="text-sm">{status.url ?? "unknown"}</Code>
      </Text>
      <Text className="text-sm">Login: {status.login ?? "unknown"}</Text>
      <Text className="text-sm">
        Accounts read:{" "}
        {status.accounts.length === 0 ? "none" : status.accounts.join(", ")}
      </Text>
      <View className="flex-row flex-wrap items-center gap-xs">
        <Text className="text-sm">
          Stream (server to reviewflow): {status.stream}
        </Text>
        <Text className="text-sm text-muted">· this page:</Text>
        <LiveIndicator />
      </View>
    </View>
  );
}

/** The reviewflow connection: its status, the url and token, and forgetting it. */
function ConnectionSection(): ReactNode {
  const client = useQueryClient();
  const status = useQuery({ queryKey: statusQueryKey, queryFn: readStatus });
  const [url, setUrl] = useState<string | null>(null);
  const [token, setToken] = useState("");
  const [confirmForget, setConfirmForget] = useState(false);

  const shownUrl = url ?? status.data?.url ?? defaultReviewflowUrl;
  const statusError = status.data?.error ?? null;

  return (
    <Box className="surface gap-m p-m">
      <View className="flex-row flex-wrap items-center gap-xs">
        <Text className="font-heading-bold text-lg">reviewflow</Text>
        {status.data === undefined ? null : (
          <Badge accent={status.data.configured ? "success" : "warning"}>
            {status.data.configured ? "connected" : "no token"}
          </Badge>
        )}
      </View>
      <Text className="text-sm text-muted">
        The token is sent to the app server, checked against reviewflow, and
        kept there (encrypted, key in the macOS keychain). It is never shown
        again.
      </Text>

      {status.data === undefined ? (
        <Text className="text-sm text-muted">
          {status.error === null
            ? "Reading the status…"
            : errorToMessage(status.error)}
        </Text>
      ) : (
        <ConnectionStatus status={status.data} />
      )}
      {statusError === null ? null : <ErrorMessage>{statusError}</ErrorMessage>}

      <FormItem
        label="reviewflow URL"
        render={({ labelId }) => (
          <InputText
            mode="url"
            value={shownUrl}
            aria-labelledby={labelId}
            onChangeText={setUrl}
          />
        )}
      />
      <FormItem
        label="Token"
        render={({ labelId }) => (
          <InputPassword
            value={token}
            aria-labelledby={labelId}
            autoComplete="off"
            placeholder="a reviewflow API token"
            onChangeText={setToken}
          />
        )}
      />
      <View className="flex-row gap-xs">
        <ActionButton
          text="Save"
          accent="brand"
          disabled={token.trim() === "" || shownUrl.trim() === ""}
          errorToMessage={errorToMessage}
          onPress={async () => {
            await saveToken(client, {
              url: shownUrl.trim(),
              token: token.trim(),
            });
            setToken("");
            setUrl(null);
          }}
        />
        <Button
          text="Forget"
          accent="danger"
          variant="tonal"
          disabled={status.data?.configured !== true}
          onPress={() => {
            setConfirmForget(true);
          }}
        />
      </View>

      <WarningAlertDialog
        visible={confirmForget}
        title="Forget the reviewflow token?"
        confirmText="Forget"
        errorToMessage={errorToMessage}
        onCancel={() => {
          setConfirmForget(false);
        }}
        onConfirm={async () => {
          await forgetToken(client);
          setConfirmForget(false);
        }}
      >
        The stored token is deleted from this machine. The pull request list
        stops until you save a token again.
      </WarningAlertDialog>
    </Box>
  );
}

/**
 * The editor of `config.json`, mounted once the file is read. With `add`
 * (`?add=owner/repo`, from a pull request whose repository is not attached) it
 * starts on the text with that entry added and the cursor in its path, unsaved.
 * Worked out once, at mount: a later read (after a save) must not move the
 * cursor again.
 */
function CheckoutsEditor({
  file,
  add,
}: {
  file: ConfigFile;
  add: string | undefined;
}): ReactNode {
  const client = useQueryClient();
  // oxlint-disable-next-line react/hook-use-state -- held for the life of the editor, never set
  const [suggestion] = useState(() =>
    add === undefined || add === ""
      ? null
      : insertCheckoutEntry(file.source, add),
  );
  return (
    <EditableFile
      language="json"
      aria-label="config.json"
      path={file.path}
      source={file.source}
      initialValue={suggestion?.source}
      cursor={suggestion?.cursor ?? null}
      onSave={(source, expectedSource) =>
        saveConfigFile(client, source, expectedSource)
      }
    />
  );
}

/**
 * `config.json`, edited in place: the checkouts the diff is read from. Read
 * from disk on each visit and never kept: an editor opening on a stale copy
 * would only meet a conflict at its first save.
 */
function CheckoutsSection(): ReactNode {
  const params = useLocalSearchParams<{ add?: string }>();
  const add = Array.isArray(params.add) ? params.add[0] : params.add;
  const file = useQuery({
    queryKey: configFileKey,
    queryFn: readConfigFile,
    gcTime: 0,
  });

  return (
    <Box className="surface gap-m p-m">
      <Text className="font-heading-bold text-lg">Checkouts</Text>
      <Text className="text-sm text-muted">
        The git diff is read from a local checkout of the repository. Map each{" "}
        <Code>owner/repo</Code> to the absolute path (or <Code>~/path</Code>) of
        a checkout whose origin remote is that repository:{" "}
        <Code>{'{ "repos": { "owner/repo": "/absolute/path" } }'}</Code>. A path
        that is missing or names another repository is saved with a warning.
      </Text>
      <Text className="text-sm text-muted">
        A repository missing from <Code>repos</Code> is searched in{" "}
        <Code>defaultRepoPath</Code> (<Code>{defaultRepoPath}</Code> when
        unset), as <Code>{"<path>/<repo>"}</Code> or{" "}
        <Code>{"<path>/<any directory>/<repo>"}</Code>, and used when its origin
        remote is that repository.
      </Text>
      {file.data === undefined ? (
        <Text className="text-sm text-muted">
          {file.error === null
            ? "Reading the config…"
            : errorToMessage(file.error)}
        </Text>
      ) : (
        <CheckoutsEditor file={file.data} add={add} />
      )}
    </Box>
  );
}

/** How diffs render, the reviewflow connection, and the checkouts: one card each, in two columns on a large screen. */
export default function SettingsPage(): ReactNode {
  const router = useRouter();
  const diffPreferences = useDiffPreferences();

  return (
    <ScreenScrollView>
      <View className="mx-auto w-full max-w-[720px] gap-l px-m py-xl md:px-l lg:max-w-[1440px]">
        <View className="flex-row items-center gap-xs">
          <IconButton
            icon={<ArrowLeftRegularIcon />}
            size="sm"
            aria-label="Back"
            onPress={() => {
              if (router.canGoBack()) router.back();
              else router.replace("/");
            }}
          />
          <Text className="font-heading-extrabold text-2xl">
            reviewflow settings
          </Text>
        </View>

        <View className="gap-l lg:flex-row lg:items-start">
          <View className="min-w-0 gap-l lg:flex-1">
            <DiffSettingsSection
              settings={diffPreferences.settings}
              onChange={diffPreferences.change}
            />
          </View>
          <View className="min-w-0 gap-l lg:flex-1">
            <ConnectionSection />
            <CheckoutsSection />
          </View>
        </View>
      </View>
    </ScreenScrollView>
  );
}
