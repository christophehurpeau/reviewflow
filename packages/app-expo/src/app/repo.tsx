import type { BranchDiffScope, DiffWhitespace } from "@reviewflow/sdk";
import { BranchDiffView, DiffSettingsProvider } from "@reviewflow/ui";
import { ErrorMessage, IconButton, View } from "alouette";
import { ArrowLeftRegularIcon } from "alouette-icons/phosphor-icons/ArrowLeft";
import { useLocalSearchParams, useRouter } from "expo-router";
import type { ReactNode } from "react";
import { useState } from "react";
import { useDiffPreferences } from "#/services/DiffPreferencesProvider.tsx";
import { useRepoDiff } from "#/services/reposApi.ts";

const first = (value: string[] | string | undefined): string | undefined =>
  Array.isArray(value) ? value[0] : value;

interface RepoDiffProps {
  ownerRepo: string;
  initialWhitespace: DiffWhitespace;
  back: ReactNode;
}

function RepoDiff({
  ownerRepo,
  initialWhitespace,
  back,
}: RepoDiffProps): ReactNode {
  const [scope, setScope] = useState<BranchDiffScope>("all");
  const [whitespace, setWhitespace] = useState(initialWhitespace);
  const { data, error, isFetching, refetch } = useRepoDiff({
    ownerRepo,
    scope,
    whitespace,
  });

  return (
    <BranchDiffView
      title={ownerRepo}
      diff={data ?? null}
      error={error?.message ?? null}
      loading={isFetching}
      scope={scope}
      whitespace={whitespace}
      headerStart={back}
      onReload={() => {
        // a failed read is the query's error, shown in place
        refetch().catch(() => undefined);
      }}
      onScopeChange={setScope}
      onWhitespaceToggle={() => {
        setWhitespace(whitespace === "show" ? "hide" : "show");
      }}
    />
  );
}

/** One configured checkout: its checked-out branch against the repository's default branch. */
export default function RepoPage(): ReactNode {
  const router = useRouter();
  const params = useLocalSearchParams<{ repo?: string }>();
  const ownerRepo = first(params.repo) ?? "";
  const valid = /^[^/\s]+\/[^/\s]+$/.test(ownerRepo);
  const { settings, loaded } = useDiffPreferences();

  const back = (
    <IconButton
      icon={<ArrowLeftRegularIcon />}
      size="sm"
      aria-label="Back to the repositories"
      onPress={() => {
        if (router.canGoBack()) router.back();
        else router.replace("/repos");
      }}
    />
  );

  if (!valid) {
    return (
      <View className="mx-auto w-full max-w-[1200px] gap-m px-l pt-l">
        <View className="flex-row">{back}</View>
        <ErrorMessage>
          This address is not a repository: it needs ?repo=owner/repo.
        </ErrorMessage>
      </View>
    );
  }
  // the whitespace preference is read once, when the screen mounts
  if (!loaded) return null;

  return (
    <View className="mx-auto min-h-0 w-full max-w-[1800px] flex-1">
      <DiffSettingsProvider
        theme={settings.theme}
        font={settings.font}
        customFont={settings.customFont}
        wordWrap={settings.wordWrap}
      >
        <RepoDiff
          ownerRepo={ownerRepo}
          initialWhitespace={settings.hideWhitespace ? "hide" : "show"}
          back={back}
        />
      </DiffSettingsProvider>
    </View>
  );
}
