import type { IconButtonProps } from "alouette";
import { IconButton, Tooltip } from "alouette";
import type { ReactNode } from "react";

/**
 * An icon-only button whose label shows on hover, so its purpose is not left
 * to the glyph. A disabled one shows its reason instead, in the tooltip the
 * button renders itself. To replace by alouette's own once released:
 * https://github.com/christophehurpeau/alouette/pull/448
 */
export function TooltipIconButton(props: IconButtonProps): ReactNode {
  const { disabledReason, "aria-label": label } = props;
  return (
    <Tooltip
      content={disabledReason ? null : label}
      // the label already names the button: as its description too, a screen reader reads it twice
      render={(triggerProps) => (
        <IconButton
          {...props}
          {...triggerProps}
          aria-describedby={undefined}
          accessibilityHint={undefined}
        />
      )}
    />
  );
}
