import type {
  PullRequestCheck,
  PullRequestChecksResponse,
} from "@reviewflow/sdk";
import { checksSummary } from "@reviewflow/sdk";
import type { Accent } from "alouette";
import { AccentScope, ExternalLinkText, Icon, Text, View } from "alouette";
import { CheckCircleRegularIcon } from "alouette-icons/phosphor-icons/CheckCircle";
import { CircleNotchRegularIcon } from "alouette-icons/phosphor-icons/CircleNotch";
import { ClockRegularIcon } from "alouette-icons/phosphor-icons/Clock";
import { XCircleRegularIcon } from "alouette-icons/phosphor-icons/XCircle";
import type { ReactNode } from "react";
import type { PullRequestReadState } from "../dataSource.ts";
import { PullRequestPartPending } from "./pull-request-part-notice.tsx";

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

/**
 * The passing checks are a count: what needs reading is what failed or has
 * not finished, and a list of forty green lines buries it. Takes the `checks`
 * part as read, its wait or its failure shown in place until an answer.
 */
export function PullRequestChecksSummary({
  checks: { value, error },
}: {
  checks: Pick<
    PullRequestReadState<PullRequestChecksResponse>,
    "error" | "value"
  >;
}): ReactNode {
  if (value === null) {
    return <PullRequestPartPending error={error} what="the checks" />;
  }
  const { checks, checksTotal } = value;
  if (checksTotal === 0) {
    return <Text className="text-sm text-muted">no checks</Text>;
  }
  const unsettled = checks.filter((check) => check.outcome !== "passed");
  const { passed } = checksSummary(checks);
  const unlisted = checksTotal - checks.length;

  return (
    <View className="gap-xs">
      {unsettled.map((check) => (
        <CheckLine key={check.name} check={check} />
      ))}
      <Text className="text-sm text-muted">
        {`${String(passed)} passing${unlisted > 0 ? `, ${String(unlisted)} more not listed` : ""}`}
      </Text>
    </View>
  );
}
