import { AccentScope, Icon, Text, View } from "alouette";
import type { Accent, SVGIconElement } from "alouette";
import type { ReactNode } from "react";

interface ListSectionProps {
  title: string;
  icon?: SVGIconElement;
  /** tints the icon and the title, the way the slack home colors its section emojis */
  accent?: Accent;
  children: ReactNode;
}

/**
 * Heading above a list of pressable rows. Rows are raised on their own, so the
 * section stays on the screen background rather than in a surface.
 */
export function ListSection({
  title,
  icon,
  accent,
  children,
}: ListSectionProps): ReactNode {
  return (
    <View className="gap-xs">
      <AccentScope accent={accent}>
        <View className="flex-row items-center gap-xs">
          {icon ? (
            <Icon
              icon={icon}
              size={20}
              className={accent ? "text-accent" : "text-muted"}
            />
          ) : null}
          <Text
            className={
              accent
                ? "font-heading-bold text-lg text-accent"
                : "font-heading-bold text-lg"
            }
          >
            {title}
          </Text>
        </View>
      </AccentScope>
      {children}
    </View>
  );
}
