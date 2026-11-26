import type {
  DiffGroup,
  DiffWalkthrough,
  DiffWalkthroughSource,
  DiffWalkthroughStatement,
  DiffWalkthroughStep,
  DiffWalkthroughWeakness,
} from "@reviewflow/sdk";
import {
  diffPaths,
  formatRelativeDate,
  patchOfHunks,
  patchOutsideHunks,
  stepHunks,
  walkthroughSteps,
} from "@reviewflow/sdk";
import {
  Disclosure,
  ExternalLinkText,
  PressableBox,
  Text,
  View,
  WarningMessage,
} from "alouette";
import type { ReactNode } from "react";
import { useMemo } from "react";
import type { DiffStepperLayout, DiffStepperSection } from "./diff-stepper.tsx";
import { DiffStepper } from "./diff-stepper.tsx";
import { MarkdownText } from "./markdown-text.tsx";

/** `stacked` shows a file cited by two steps in both. */
export type WalkthroughLayout = DiffStepperLayout;

export interface WalkthroughDisplay {
  walkthrough: DiffWalkthrough;
  layout: WalkthroughLayout;
}

/** The diff's groups narrowed to the files of a part of its patch. */
export const groupsOfPatch = (
  groups: readonly DiffGroup[],
  patch: string,
): DiffGroup[] => {
  const paths = new Set(diffPaths(patch));
  return groups.flatMap((group) => {
    const kept = group.paths.filter((path) => paths.has(path));
    return kept.length === 0 ? [] : [{ ...group, paths: kept }];
  });
};

/** Where a statement comes from, as one quiet line under it. */
function SourceLine({
  sources,
}: {
  sources: readonly DiffWalkthroughSource[];
}): ReactNode {
  return (
    <View className="flex-row flex-wrap items-center gap-x-xs">
      <Text className="text-xs text-muted">From</Text>
      {sources.map(({ label, url }, index) => (
        <View
          key={`${String(index)}:${label}`}
          className="flex-row items-center gap-x-xs"
        >
          {index === 0 ? null : <Text className="text-xs text-muted">·</Text>}
          {url === null ? (
            <Text className="text-xs text-muted">{label}</Text>
          ) : (
            <ExternalLinkText
              accent="info"
              icon={null}
              size="sm"
              href={url}
              text={label}
            />
          )}
        </View>
      ))}
    </View>
  );
}

function Statement({
  statement,
}: {
  statement: DiffWalkthroughStatement;
}): ReactNode {
  return (
    <View className="gap-xxs">
      <MarkdownText text={statement.text} />
      <SourceLine sources={statement.sources} />
    </View>
  );
}

/**
 * A weak point a source raised, what was decided on it, and where both come
 * from. Always inside a raised box (the context's card, a step's text): flat.
 */
function Weakness({
  weakness,
}: {
  weakness: DiffWalkthroughWeakness;
}): ReactNode {
  return (
    <WarningMessage variant="flat">
      <View className="gap-xs">
        <MarkdownText text={weakness.text} />
        {weakness.decision === null ? (
          <Text className="text-sm text-muted">No decision recorded</Text>
        ) : (
          <View className="flex-row items-baseline gap-xs">
            <Text className="font-body-bold text-sm">Decided</Text>
            <View className="min-w-0 flex-1">
              <MarkdownText text={weakness.decision} />
            </View>
          </View>
        )}
        <SourceLine sources={weakness.sources} />
      </View>
    </WarningMessage>
  );
}

function WalkthroughMeta({
  walkthrough,
}: {
  walkthrough: DiffWalkthrough;
}): ReactNode {
  const { ticket } = walkthrough;
  return (
    <View className="flex-row flex-wrap items-center gap-x-sm gap-y-xxs">
      {ticket === null ? null : (
        <View className="flex-row flex-wrap items-center gap-xs">
          {ticket.url === null ? (
            <Text className="text-sm">{ticket.key}</Text>
          ) : (
            <ExternalLinkText
              accent="info"
              icon={null}
              size="sm"
              href={ticket.url}
              text={ticket.key}
            />
          )}
          {ticket.title === null ? null : (
            <Text numberOfLines={1} className="text-sm text-muted">
              {ticket.title}
            </Text>
          )}
        </View>
      )}
      <Text className="text-xs text-muted">
        {`Written on ${walkthrough.head.slice(0, 7)}, ${formatRelativeDate(walkthrough.writtenAt)}`}
      </Text>
    </View>
  );
}

interface WalkthroughOutlineProps {
  walkthrough: DiffWalkthrough;
  onStepPress: (stepId: string) => void;
}

/** How the pull request is split: its chapters in reading order, each leading to its first step. */
function WalkthroughOutline({
  walkthrough,
  onStepPress,
}: WalkthroughOutlineProps): ReactNode {
  return (
    <View className="gap-xs">
      <Text className="font-body-bold text-sm text-muted">How it is split</Text>
      {walkthrough.chapters.map((chapter, index) => {
        const firstStep = chapter.steps[0];
        return (
          <PressableBox
            key={chapter.id}
            variant="soft"
            accent="neutral"
            aria-label={`Go to ${chapter.title}`}
            className="flex-row items-baseline gap-sm rounded-sm px-xs py-xs"
            onPress={() => {
              if (firstStep !== undefined) onStepPress(firstStep.id);
            }}
          >
            <Text className="font-body-bold text-sm text-muted">
              {`${String(index + 1)}.`}
            </Text>
            <View className="min-w-0 flex-1 gap-xxs">
              <View className="flex-row flex-wrap items-baseline gap-x-sm">
                <Text className="font-body-bold text-sharp">
                  {chapter.title}
                </Text>
                <Text className="text-xs text-muted">
                  {`${String(chapter.steps.length)} ${chapter.steps.length === 1 ? "step" : "steps"}`}
                </Text>
              </View>
              {chapter.summary === "" ? null : (
                <MarkdownText text={chapter.summary} />
              )}
            </View>
          </PressableBox>
        );
      })}
    </View>
  );
}

/** The weak points in none of the steps, which only the context can carry. */
const globalWeaknessesOf = (
  walkthrough: DiffWalkthrough,
): DiffWalkthroughWeakness[] =>
  walkthrough.weaknesses.filter(({ steps }) => steps.length === 0);

/**
 * What the walkthrough says before any step: the problem with where it comes
 * from, how the pull request is split, and the weak points no step holds. A
 * weak point in the code is shown in its step, next to that code.
 */
function WalkthroughContext({
  walkthrough,
  onStepPress,
}: WalkthroughOutlineProps): ReactNode {
  const weaknesses = globalWeaknessesOf(walkthrough);
  return (
    <View className="surface surface-m gap-m">
      <View className="gap-xxs">
        <Text className="font-heading-bold text-lg text-sharp">
          {walkthrough.title}
        </Text>
        <WalkthroughMeta walkthrough={walkthrough} />
      </View>
      <Statement statement={walkthrough.problem} />
      <WalkthroughOutline walkthrough={walkthrough} onStepPress={onStepPress} />
      {weaknesses.length === 0 ? null : (
        <Disclosure
          defaultExpanded
          label={`${String(weaknesses.length)} weak ${weaknesses.length === 1 ? "point" : "points"} and what was decided`}
        >
          <View className="gap-sm">
            {weaknesses.map((weakness, index) => (
              <Weakness
                key={`${String(index)}:${weakness.text}`}
                weakness={weakness}
              />
            ))}
          </View>
        </Disclosure>
      )}
    </View>
  );
}

interface StepDescriptionProps {
  walkthrough: DiffWalkthrough;
  step: DiffWalkthroughStep;
}

function StepDescription({
  walkthrough,
  step,
}: StepDescriptionProps): ReactNode {
  return (
    <View className="gap-sm rounded-sm bg-highlight p-m shadow-s">
      <MarkdownText text={step.explanation} />
      {step.notes.length === 0 ? null : (
        <View className="gap-xxs">
          {step.notes.map(({ hunk, text }, index) => {
            const range = walkthrough.hunks[hunk];
            return (
              <View key={`${String(index)}:${hunk}`} className="gap-xxs">
                <Text className="font-mono text-xs text-muted">
                  {range === undefined
                    ? hunk
                    : `${range.path}:${String(range.newStart)}`}
                </Text>
                <MarkdownText text={text} />
              </View>
            );
          })}
        </View>
      )}
      {step.concerns.length === 0 ? null : (
        <WarningMessage variant="flat">
          <View className="gap-xxs">
            {step.concerns.map((concern, index) => (
              <Text key={`${String(index)}:${concern}`} className="text-sm">
                {concern}
              </Text>
            ))}
          </View>
        </WarningMessage>
      )}
      {walkthrough.weaknesses
        .filter(({ steps }) => steps.includes(step.id))
        .map((weakness, index) => (
          <Weakness
            key={`${String(index)}:${weakness.text}`}
            weakness={weakness}
          />
        ))}
    </View>
  );
}

function OutsideDescription(): ReactNode {
  return (
    <View className="rounded-sm bg-highlight p-m shadow-s">
      <Text className="text-sm text-muted">
        The changes no step cites: lockfiles, generated files, and anything the
        walkthrough left out.
      </Text>
    </View>
  );
}

const outsideKey = "outside";

/** One section per step, then what no step covers. */
const sectionsOf = (
  walkthrough: DiffWalkthrough,
  patch: string,
): DiffStepperSection[] => {
  const steps = walkthrough.chapters.flatMap((chapter, chapterIndex) =>
    chapter.steps.map((step, stepIndex): DiffStepperSection => ({
      key: step.id,
      title: `${String(chapterIndex + 1)}.${String(stepIndex + 1)} ${step.title}`,
      chapterTitle: chapter.title,
      description: <StepDescription walkthrough={walkthrough} step={step} />,
      patch: patchOfHunks(patch, stepHunks(walkthrough, step)),
    })),
  );
  const outside = patchOutsideHunks(
    patch,
    walkthroughSteps(walkthrough).flatMap((step) =>
      stepHunks(walkthrough, step),
    ),
  );
  if (outside === "") return steps;
  return [
    ...steps,
    {
      key: outsideKey,
      title: "Outside the walkthrough",
      chapterTitle: null,
      description: <OutsideDescription />,
      patch: outside,
    },
  ];
};

export interface PullRequestWalkthroughDiffProps {
  display: WalkthroughDisplay;
  /** the shown diff's patch: whitespace hidden or not, the steps are its parts */
  patch: string;
  /** the side column, from the diff's own breakpoint */
  aside: boolean;
  /** where the side column sticks: the toolbar's height */
  stickyTop: number;
  /** a part of the diff, its file headers sticking at `stickyTop` */
  renderDiff: (patch: string, stickyTop: number) => ReactNode;
  /** the files marked Viewed, which read the steps they make up */
  viewedPaths: readonly string[];
}

/**
 * The diff read through a walkthrough: its context, then each step's
 * explanation over the part of the diff it cites, and last what no step
 * cites. A step is matched to the shown diff by its hunks' lines, so a diff
 * with whitespace hidden still splits.
 */
export function PullRequestWalkthroughDiff({
  display,
  patch,
  aside,
  stickyTop,
  renderDiff,
  viewedPaths,
}: PullRequestWalkthroughDiffProps): ReactNode {
  const { walkthrough, layout } = display;
  const sections = useMemo(
    () => sectionsOf(walkthrough, patch),
    [walkthrough, patch],
  );
  return (
    <DiffStepper
      key={`${walkthrough.head}:${walkthrough.writtenAt}`}
      sections={sections}
      layout={layout}
      renderIntro={(goTo) => (
        <WalkthroughContext walkthrough={walkthrough} onStepPress={goTo} />
      )}
      aside={aside}
      stickyTop={stickyTop}
      renderDiff={(section, sectionStickyTop) =>
        renderDiff(section.patch, sectionStickyTop)
      }
      viewedPaths={viewedPaths}
    />
  );
}
