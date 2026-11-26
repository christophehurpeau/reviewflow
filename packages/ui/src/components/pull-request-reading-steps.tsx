import type {
  DiffFileImpacts,
  DiffImpactsResponse,
  DiffReadingOrderResponse,
  DiffReadingStep,
} from "@reviewflow/sdk";
import {
  patchOfPaths,
  pluralOf,
  readingOrderOfStep,
  readingStepPaths,
  readingStepsOf,
} from "@reviewflow/sdk";
import { Text, View } from "alouette";
import type { ReactNode } from "react";
import { useMemo } from "react";
import type { DiffStepperSection } from "./diff-stepper.tsx";
import { DiffStepper } from "./diff-stepper.tsx";
import { countImpacts, usageLabel } from "./pull-request-diff-impacts.ts";

const packageTitle = (group: string): string => (group === "" ? "Root" : group);

/** The path within its package, which the package's heading already names. */
const pathInPackage = (path: string, group: string): string =>
  group !== "" && path.startsWith(`${group}/`)
    ? path.slice(group.length + 1)
    : path;

const stepTitle = ({ entry, group }: DiffReadingStep): string =>
  entry === null ? "Other files" : pathInPackage(entry, group);

interface ReadingStepDescriptionProps {
  step: DiffReadingStep;
  /** the step's files' impacts; null while unknown */
  impacts: DiffFileImpacts[] | null;
}

function ReadingStepDescription({
  step,
  impacts,
}: ReadingStepDescriptionProps): ReactNode {
  const tests = step.files.flatMap(({ attached }) => attached).length;
  const counts = impacts === null ? null : countImpacts(impacts);
  return (
    <View className="gap-xxs">
      <Text className="text-sm text-muted">
        {step.entry === null
          ? `${pluralOf(step.files.length, "file")} no entry point reaches`
          : [
              pluralOf(step.files.length, "file"),
              ...(tests === 0 ? [] : [pluralOf(tests, "test")]),
            ].join(" · ")}
      </Text>
      {counts === null || counts.exports === 0 ? null : (
        <Text className="text-sm text-muted">
          {`${pluralOf(counts.exports, "touched export")} used in ${usageLabel(counts)} outside the diff${counts.removed ? ", some removed" : ""}`}
        </Text>
      )}
    </View>
  );
}

const impactsOfPaths = (
  impacts: DiffImpactsResponse | null,
  paths: readonly string[],
): DiffFileImpacts[] | null => {
  if (impacts === null || impacts.tooLarge) return null;
  const kept = new Set(paths);
  return impacts.files.filter(({ path }) => kept.has(path));
};

export interface PullRequestReadingStepsProps {
  readingOrder: DiffReadingOrderResponse;
  impacts: DiffImpactsResponse | null;
  /** the shown diff's patch, which the steps cut by file */
  patch: string;
  /** the side column, from the diff's own breakpoint */
  aside: boolean;
  /** where the side column sticks: the toolbar's height */
  stickyTop: number;
  /** a step's part of the diff, laid out by its own reading order */
  renderDiff: (
    patch: string,
    readingOrder: DiffReadingOrderResponse,
    stickyTop: number,
  ) => ReactNode;
  /** the files marked Viewed, which read the steps they make up */
  viewedPaths: readonly string[];
}

/**
 * The reading order read one step at a time: a step per entry point with the
 * changed files it imports and their tests, then each package's other files,
 * packages from the one depending on the others down.
 */
export function PullRequestReadingSteps({
  readingOrder,
  impacts,
  patch,
  aside,
  stickyTop,
  renderDiff,
  viewedPaths,
}: PullRequestReadingStepsProps): ReactNode {
  const steps = useMemo(() => readingStepsOf(readingOrder), [readingOrder]);
  const sections = useMemo(
    () =>
      steps.map((step): DiffStepperSection => {
        const paths = readingStepPaths(step);
        return {
          key: step.key,
          title: stepTitle(step),
          chapterTitle: packageTitle(step.group),
          description: (
            <ReadingStepDescription
              step={step}
              impacts={impactsOfPaths(impacts, paths)}
            />
          ),
          patch: patchOfPaths(patch, paths),
        };
      }),
    [steps, impacts, patch],
  );
  const stepsByKey = useMemo(
    () => new Map(steps.map((step) => [step.key, step])),
    [steps],
  );
  return (
    <DiffStepper
      sections={sections}
      layout="stepper"
      aside={aside}
      stickyTop={stickyTop}
      renderDiff={(section, sectionStickyTop) => {
        const step = stepsByKey.get(section.key);
        if (step === undefined) return null;
        return renderDiff(
          section.patch,
          readingOrderOfStep(step),
          sectionStickyTop,
        );
      }}
      viewedPaths={viewedPaths}
    />
  );
}
