import { AccentScope, HStack, Icon, Text, VStack } from "alouette";
import type { Accent, SVGIconElement } from "alouette";
import type { ReactNode } from "react";

interface ListSectionProps {
  title: string;
  icon?: SVGIconElement;
  /** tints the icon only, the way the slack home colors its section emojis */
  iconAccent?: Accent;
  children: ReactNode;
}

/**
 * Heading above a list of pressable rows. Rows are raised on their own, so the
 * section stays on the screen background rather than in a Surface.
 */
export function ListSection({
  title,
  icon,
  iconAccent,
  children,
}: ListSectionProps): ReactNode {
  return (
    <VStack className="gap-xs">
      <HStack className="mx-xs items-center gap-xs">
        {icon ? (
          <AccentScope accent={iconAccent}>
            <Icon
              icon={icon}
              size={20}
              className={iconAccent ? "text-accent" : "text-muted"}
            />
          </AccentScope>
        ) : null}
        <Text className="font-heading-bold text-lg">{title}</Text>
      </HStack>
      {children}
    </VStack>
  );
}
