import { ExternalLinkText, WarningMessage } from "alouette";
import type { ReactNode } from "react";
import { paidFeaturesContactEmail } from "reviewflow-modules";

interface NotEnabledMessageProps {
  /** what is not enabled, as a sentence: "Live updates are not enabled for acme." */
  children: string;
  /** `flat` inside a raised surface */
  variant?: "flat" | "surface";
}

/** a paid feature the admin has not enabled: the way out is the contact email */
export function NotEnabledMessage({
  children,
  variant,
}: NotEnabledMessageProps): ReactNode {
  return (
    <WarningMessage variant={variant}>
      {`${children} Contact `}
      {/* TODO remove once https://github.com/christophehurpeau/alouette/issues/385
          is fixed: inside a Text the link is baselined on the icon's bottom */}
      <ExternalLinkText
        size="sm"
        className="web:items-baseline"
        href={`mailto:${paidFeaturesContactEmail}`}
        text={paidFeaturesContactEmail}
      />
      {" to enable it."}
    </WarningMessage>
  );
}
