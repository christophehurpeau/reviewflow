import type { PullRequestRef } from "@reviewflow/sdk";
import { parseBoardFilters, toBoardFilterParams } from "@reviewflow/sdk";
import { BoardDataSourceProvider, PullRequestBoard } from "@reviewflow/ui";
import { useQueryClient } from "@tanstack/react-query";
import {
  Button,
  PressableListItem,
  ScreenScrollView,
  SectionTitle,
  Text,
  View,
} from "alouette";
import { ClockCounterClockwiseRegularIcon } from "alouette-icons/phosphor-icons/ClockCounterClockwise";
import { MagnifyingGlassRegularIcon } from "alouette-icons/phosphor-icons/MagnifyingGlass";
import { Link, useLocalSearchParams, useRouter } from "expo-router";
import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import { OpenPullRequestModal } from "#/services/OpenPullRequestModal.tsx";
import { createBoardDataSource } from "#/services/boardDataSource.tsx";
import {
  readRecentPullRequests,
  rememberPullRequest,
} from "#/services/recentPullRequests.ts";

function ConnectReviewflow(): ReactNode {
  return (
    <Link asChild href="/settings">
      <Button text="Connect reviewflow" accent="brand" role="link" />
    </Link>
  );
}

interface RecentPullRequestsProps {
  recent: PullRequestRef[];
  onOpen: (ref: PullRequestRef) => void;
}

function RecentPullRequests({
  recent,
  onOpen,
}: RecentPullRequestsProps): ReactNode {
  if (recent.length === 0) return null;

  return (
    <View className="gap-xs">
      <SectionTitle icon={<ClockCounterClockwiseRegularIcon />}>
        Recently opened
      </SectionTitle>
      {recent.map((ref) => (
        <PressableListItem
          key={`${ref.ownerRepo}#${String(ref.number)}`}
          role="link"
          aria-label={`Open ${ref.ownerRepo}#${String(ref.number)}`}
          onPress={() => {
            onOpen(ref);
          }}
        >
          <Text className="font-mono text-sm">
            {`${ref.ownerRepo}#${String(ref.number)}`}
          </Text>
        </PressableListItem>
      ))}
    </View>
  );
}

export default function HomePage(): ReactNode {
  const router = useRouter();
  const params = useLocalSearchParams<{
    state?: string;
    account?: string;
    repo?: string;
    author?: string;
    draft?: string;
    checks?: string;
    search?: string;
    review?: string;
    label?: string;
    inactive?: string;
  }>();
  const [opening, setOpening] = useState(false);
  const client = useQueryClient();
  const boardSource = useMemo(() => createBoardDataSource(client), [client]);
  const [recent, setRecent] = useState(readRecentPullRequests);

  const open = (ref: PullRequestRef): void => {
    setRecent(rememberPullRequest(ref));
    router.push({
      pathname: "/pull-request",
      params: { repo: ref.ownerRepo, number: String(ref.number) },
    });
  };

  return (
    <ScreenScrollView>
      <View className="page-container gap-xl py-l">
        <BoardDataSourceProvider value={boardSource}>
          <PullRequestBoard
            filtering={{
              value: parseBoardFilters(params),
              onChange: (filters) => {
                router.replace({
                  pathname: "/",
                  params: toBoardFilterParams(filters),
                });
              },
            }}
            actions={
              <Button
                text="Open a pull request"
                icon={<MagnifyingGlassRegularIcon />}
                accent="info"
                size="sm"
                onPress={() => {
                  setOpening(true);
                }}
              />
            }
            renderConnect={() => <ConnectReviewflow />}
            onOpenPullRequest={open}
          />
        </BoardDataSourceProvider>

        <RecentPullRequests recent={recent} onOpen={open} />
      </View>
      <OpenPullRequestModal
        visible={opening}
        onClose={() => {
          setOpening(false);
        }}
        onOpen={(ref) => {
          setOpening(false);
          open(ref);
        }}
      />
    </ScreenScrollView>
  );
}
