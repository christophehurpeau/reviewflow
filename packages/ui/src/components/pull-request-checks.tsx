import type { PullRequestCheck } from "@reviewflow/sdk";
import type { Accent } from "alouette";
import { AccentScope, ExternalLinkText, Icon, Text, View } from "alouette";
import { CheckCircleRegularIcon } from "alouette-icons/phosphor-icons/CheckCircle";
import { CircleNotchRegularIcon } from "alouette-icons/phosphor-icons/CircleNotch";
import { ClockRegularIcon } from "alouette-icons/phosphor-icons/Clock";
import { XCircleRegularIcon } from "alouette-icons/phosphor-icons/XCircle";
import type { ReactNode } from "react";

const checkAccent = (outcome: PullRequestCheck["outcome"]): Accent => {
  if (outcome === "failed") return "danger";
  if (outcome === "pending") return "warning";
  return "success";
};

const checkLabel = (check: PullRequestCheck): string => {
  if (check.outcome === "failed") return "failing";
  if (check.running) return "running";
  if (check.outcome === "pending") return "pending";
  return "passing";
};

function CheckGlyph({ check }: { check: PullRequestCheck }): ReactNode {
  if (check.outcome === "failed") {
    return (
      <Icon icon={<XCircleRegularIcon />} size={16} className="text-accent" />
    );
  }
  if (check.running) {
    return (
      <View className="motion-safe:animate-spin">
        <Icon
          icon={<CircleNotchRegularIcon />}
          size={16}
          className="text-accent"
        />
      </View>
    );
  }
  if (check.outcome === "pending") {
    return (
      <Icon icon={<ClockRegularIcon />} size={16} className="text-accent" />
    );
  }
  return (
    <Icon icon={<CheckCircleRegularIcon />} size={16} className="text-accent" />
  );
}

/**
 * A glyph in a fixed column rather than a word badge: the sidebar is narrow,
 * and the name and what the check says about itself wrap beside it instead of
 * under it. The description of a passing check is left out — it says it passed.
 */
export function CheckLine({ check }: { check: PullRequestCheck }): ReactNode {
  return (
    <View className="flex-row items-start gap-xs">
      <AccentScope accent={checkAccent(check.outcome)}>
        <View
          role="img"
          aria-label={checkLabel(check)}
          className="h-[20px] justify-center"
        >
          <CheckGlyph check={check} />
        </View>
      </AccentScope>
      <View className="min-w-0 flex-1">
        {check.url === null ? (
          <Text className="text-sm">{check.name}</Text>
        ) : (
          <ExternalLinkText
            size="sm"
            icon={null}
            accent="neutral"
            href={check.url}
            text={check.name}
            aria-label={`Open ${check.name}`}
          />
        )}
        {check.description !== null && check.outcome !== "passed" ? (
          <Text className="text-xs text-muted">{check.description}</Text>
        ) : null}
      </View>
    </View>
  );
}
