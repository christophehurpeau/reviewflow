import type { FileDiffMetadata } from "@pierre/diffs";
import type { Accent, SVGIconElement } from "alouette";
import { AccentScope, Icon, Tooltip, View } from "alouette";
import { ArrowSquareRightRegularIcon } from "alouette-icons/phosphor-icons/ArrowSquareRight";
import { MinusSquareRegularIcon } from "alouette-icons/phosphor-icons/MinusSquare";
import { PencilSimpleLineRegularIcon } from "alouette-icons/phosphor-icons/PencilSimpleLine";
import { PlusSquareRegularIcon } from "alouette-icons/phosphor-icons/PlusSquare";
import type { ReactNode } from "react";

/**
 * For a pierre file's `unsafeCSS`, with `DiffChangeMark` in its header prefix:
 * pierre draws its change icon inside the file's shadow root, where nothing of
 * ours can give it a tooltip.
 */
export const hidePierreChangeIcon = "[data-change-icon] { display: none; }";

interface ChangeMarkProps {
  label: string;
  accent: Accent;
  icon: SVGIconElement;
}

function ChangeMark({ label, accent, icon }: ChangeMarkProps): ReactNode {
  return (
    <Tooltip
      content={label}
      render={(triggerProps) => (
        <View role="img" aria-label={label} {...triggerProps}>
          <AccentScope accent={accent}>
            <Icon icon={icon} size={16} className="text-accent" />
          </AccentScope>
        </View>
      )}
    />
  );
}

interface DiffChangeMarkProps {
  type: FileDiffMetadata["type"];
}

export function DiffChangeMark({ type }: DiffChangeMarkProps): ReactNode {
  if (type === "new") {
    return (
      <ChangeMark
        label="Added"
        accent="success"
        icon={<PlusSquareRegularIcon />}
      />
    );
  }
  if (type === "deleted") {
    return (
      <ChangeMark
        label="Deleted"
        accent="danger"
        icon={<MinusSquareRegularIcon />}
      />
    );
  }
  if (type === "rename-pure") {
    return (
      <ChangeMark
        label="Renamed, content unchanged"
        accent="warning"
        icon={<ArrowSquareRightRegularIcon />}
      />
    );
  }
  if (type === "rename-changed") {
    return (
      <ChangeMark
        label="Renamed and modified"
        accent="warning"
        icon={<ArrowSquareRightRegularIcon />}
      />
    );
  }
  return (
    <ChangeMark
      label="Modified"
      accent="info"
      icon={<PencilSimpleLineRegularIcon />}
    />
  );
}
