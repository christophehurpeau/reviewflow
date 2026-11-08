import type { PullRequestPerson } from "@reviewflow/sdk";
import { Avatar } from "alouette";
import type { ReactNode } from "react";
import { Image, View } from "react-native";

/**
 * alouette's Avatar draws initials only, so GitHub's picture is laid over it:
 * while it loads, or when it fails, the initials are what shows.
 */
export function PersonAvatar({
  person,
}: {
  person: PullRequestPerson | null;
}): ReactNode {
  const login = person?.login ?? "ghost";
  return (
    <View className="size-[28px] shrink-0">
      <Avatar size="sm" name={login} />
      {person?.avatarUrl ? (
        <Image
          source={{ uri: person.avatarUrl }}
          accessibilityLabel={login}
          className="absolute inset-0 size-[28px] rounded-full"
        />
      ) : null}
    </View>
  );
}
