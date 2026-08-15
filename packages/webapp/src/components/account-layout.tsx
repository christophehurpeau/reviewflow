import { HStack, IconButton, NavBar, NavBarItem, Text } from "alouette";
import { ArrowLeftRegularIcon } from "alouette-icons/phosphor-icons/ArrowLeftRegularIcon";
import type { Href } from "expo-router";
import { usePathname, useRouter } from "expo-router";
import type { ReactNode } from "react";
import { PageContainer } from "#/components/page-container.tsx";

export interface AccountLayoutSection {
  label: string;
  /** the string form only, `NavBarItem` renders it as an anchor on web */
  href: Extract<Href, string>;
}

interface AccountLayoutProps {
  title: string;
  sections: AccountLayoutSection[];
  children: ReactNode;
}

/**
 * Header of an account section, for the user's own account as well as for an
 * org: both hold the same kinds of pages, only reached under different routes.
 */
export function AccountLayout({
  title,
  sections,
  children,
}: AccountLayoutProps): ReactNode {
  const pathname = usePathname();
  const router = useRouter();

  return (
    <>
      <PageContainer className="gap-xs pt-l">
        <HStack className="gap-m items-center">
          <IconButton
            icon={<ArrowLeftRegularIcon />}
            variant="contained"
            size="sm"
            aria-label="Back to settings"
            onPress={() => {
              router.navigate("/settings");
            }}
          />
          <Text className="font-heading-extrabold text-3xl xl:text-4xl">
            {title}
          </Text>
        </HStack>
        <HStack className="flex-center">
          <NavBar aria-label="Account sections" value={pathname}>
            {sections.map((section) => (
              <NavBarItem
                key={section.href}
                href={section.href}
                label={section.label}
                onPress={(event) => {
                  event.preventDefault();
                  router.navigate(section.href);
                }}
              />
            ))}
          </NavBar>
        </HStack>
      </PageContainer>
      {children}
    </>
  );
}
