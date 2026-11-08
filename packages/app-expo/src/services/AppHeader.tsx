import {
  AppHeader as AlouetteAppHeader,
  AppHeaderActions,
  AppHeaderBrand,
  BrandLogo,
  ColorModePicker,
  HeaderNav,
  HeaderNavItem,
  View,
} from "alouette";
import { ChecksRegularIcon } from "alouette-icons/phosphor-icons/Checks";
import { Link, usePathname, useRouter } from "expo-router";
import type { ReactNode } from "react";
import { useColorModePreference } from "./ColorModeProvider.tsx";
import { LiveIndicator } from "./LiveIndicator.tsx";

const pullRequestsHref = "/";
const settingsHref = "/settings";

/** A pull request screen is reached from the list, so it is what the nav marks as current. */
const sectionOf = (pathname: string): string =>
  pathname.startsWith(settingsHref) ? settingsHref : pullRequestsHref;

/** The bar over every screen: the sections, the live connection, the color mode. */
export function AppHeader(): ReactNode {
  const router = useRouter();
  const pathname = usePathname();
  const { preference, setPreference } = useColorModePreference();

  return (
    <AlouetteAppHeader
      brand={
        <AppHeaderBrand
          title="reviewflow"
          brandLogo={<BrandLogo icon={<ChecksRegularIcon />} />}
          href={pullRequestsHref}
          onPress={(event) => {
            event.preventDefault();
            router.navigate(pullRequestsHref);
          }}
        />
      }
      actions={
        <AppHeaderActions>
          {/* a Badge is self-start and takes no className: centred by its wrapper */}
          <View className="items-center justify-center">
            <LiveIndicator />
          </View>
          <ColorModePicker value={preference} onValueChange={setPreference} />
        </AppHeaderActions>
      }
    >
      <HeaderNav aria-label="Sections" value={sectionOf(pathname)}>
        <Link asChild href={pullRequestsHref}>
          <HeaderNavItem label="Pull requests" />
        </Link>
        <Link asChild href={settingsHref}>
          <HeaderNavItem label="Settings" />
        </Link>
      </HeaderNav>
    </AlouetteAppHeader>
  );
}
