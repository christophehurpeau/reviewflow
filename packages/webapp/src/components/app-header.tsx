import {
  Button,
  ExternalLinkButton,
  HStack,
  NavBar,
  NavBarItem,
  Text,
  View,
} from "alouette";
import { usePathname, useRouter } from "expo-router";
import type { ReactNode } from "react";
import { pageContainerClassName } from "#/components/page-container.tsx";
import { useAuthenticatedUser } from "#/services/AuthenticatedUserProvider.tsx";
import { serverUrl } from "#/services/serverUrl.ts";

const prsHref = "/prs";
const settingsHref = "/settings";

/**
 * Every route but the pull requests one — user and org pages included — is
 * reached from the settings section, so it is what the nav marks as current.
 */
const sectionOf = (pathname: string): string =>
  pathname.startsWith(prsHref) ? prsHref : settingsHref;

export function AppHeader(): ReactNode {
  const router = useRouter();
  const pathname = usePathname();
  const user = useAuthenticatedUser();

  return (
    <View className="border-b border-muted">
      <HStack
        className={`${pageContainerClassName} flex-wrap items-center gap-m py-m`}
      >
        <Button
          variant="ghost"
          size="sm"
          text="reviewflow"
          onPress={() => {
            router.navigate("/");
          }}
        />
        <NavBar aria-label="Sections" value={sectionOf(pathname)}>
          <NavBarItem
            href={prsHref}
            label="Pull requests"
            onPress={(event) => {
              event.preventDefault();
              router.navigate(prsHref);
            }}
          />
          <NavBarItem
            href={settingsHref}
            label="Settings"
            onPress={(event) => {
              event.preventDefault();
              router.navigate(settingsHref);
            }}
          />
        </NavBar>
        <HStack className="flex-1" />
        <Text className="font-body text-sm text-muted">{user.login}</Text>
        <ExternalLinkButton
          href={serverUrl("/app/logout")}
          variant="ghost"
          size="sm"
          text="Log out"
        />
      </HStack>
    </View>
  );
}
