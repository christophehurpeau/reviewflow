import { diffPaths } from "@reviewflow/sdk";
import {
  AccentScope,
  Button,
  Checkbox,
  Icon,
  InfoMessage,
  PressableBox,
  Text,
  View,
} from "alouette";
import { CheckCircleRegularIcon } from "alouette-icons/phosphor-icons/CheckCircle";
import type { ComponentRef, ReactNode } from "react";
import { useMemo, useRef, useState } from "react";
import { revealTopOf } from "./scroll-parent.ts";

/**
 * `stepper`: one section at a time, previous and next around it. `stacked`:
 * every section one under the other.
 */
export type DiffStepperLayout = "stacked" | "stepper";

/** A part of the shown diff, read as one step. */
export interface DiffStepperSection {
  key: string;
  title: string;
  /** heads the plan's run of sections sharing it */
  chapterTitle: string | null;
  /** between the title and the diff */
  description: ReactNode;
  patch: string;
}

interface DiffStepperPlanProps {
  sections: readonly DiffStepperSection[];
  current: string | null;
  read: ReadonlySet<string>;
  onSectionPress: (key: string) => void;
}

function DiffStepperPlan({
  sections,
  current,
  read,
  onSectionPress,
}: DiffStepperPlanProps): ReactNode {
  return (
    <View className="gap-xxs">
      {sections.map((section, index) => {
        const chapterStarts =
          section.chapterTitle !== null &&
          section.chapterTitle !== sections[index - 1]?.chapterTitle;
        const isCurrent = section.key === current;
        return (
          <View key={section.key} className="gap-xxs">
            {chapterStarts ? (
              <Text className="pt-xs font-body-bold text-xs text-muted">
                {section.chapterTitle}
              </Text>
            ) : null}
            <PressableBox
              variant="soft"
              accent={isCurrent ? "info" : "neutral"}
              aria-label={`Go to ${section.title}`}
              aria-current={isCurrent ? "step" : undefined}
              className="flex-row items-center gap-xs rounded-sm px-xs py-xxs"
              onPress={() => {
                onSectionPress(section.key);
              }}
            >
              <Text
                numberOfLines={2}
                className={`min-w-0 flex-1 text-sm ${isCurrent ? "font-body-bold text-sharp" : "text-sharp"}`}
              >
                {section.title}
              </Text>
              {read.has(section.key) ? (
                <AccentScope accent="success">
                  <Icon
                    icon={<CheckCircleRegularIcon />}
                    size={14}
                    className="text-accent"
                  />
                </AccentScope>
              ) : null}
            </PressableBox>
          </View>
        );
      })}
    </View>
  );
}

interface SectionHeaderProps {
  section: DiffStepperSection;
  read: boolean;
  onReadChange: (read: boolean) => void;
}

function SectionHeader({
  section,
  read,
  onReadChange,
}: SectionHeaderProps): ReactNode {
  return (
    <View className="gap-xs">
      {section.chapterTitle === null ? null : (
        <Text className="text-xs text-muted">{section.chapterTitle}</Text>
      )}
      <View className="flex-row flex-wrap items-center justify-between gap-sm">
        <Text className="font-heading-bold text-md text-sharp">
          {section.title}
        </Text>
        <Checkbox
          label="Read"
          accent="success"
          checked={read}
          onValueChange={onReadChange}
        />
      </View>
      {section.description}
    </View>
  );
}

interface SectionBodyProps {
  section: DiffStepperSection;
  /** where the diff's file headers stick */
  stickyTop: number;
  renderDiff: (section: DiffStepperSection, stickyTop: number) => ReactNode;
}

function SectionBody({
  section,
  stickyTop,
  renderDiff,
}: SectionBodyProps): ReactNode {
  if (section.patch === "") {
    return (
      <InfoMessage>
        No change of this step is in the diff shown: whitespace is hidden, or
        the files were left out of it.
      </InfoMessage>
    );
  }
  return renderDiff(section, stickyTop);
}

export interface DiffStepperProps {
  sections: readonly DiffStepperSection[];
  layout: DiffStepperLayout;
  /** above the sections, given the way to move to one */
  renderIntro?: (goTo: (key: string) => void) => ReactNode;
  /** the side column, from the diff's own breakpoint */
  aside: boolean;
  /** where the side column sticks: the toolbar's height */
  stickyTop: number;
  /** a section's part of the diff, its file headers sticking at `stickyTop` */
  renderDiff: (section: DiffStepperSection, stickyTop: number) => ReactNode;
  /** the files marked Viewed, which read the sections they make up */
  viewedPaths: readonly string[];
}

/**
 * The diff read section by section: the plan of the sections in the side
 * column, then each section's description over its part of the diff.
 *
 * Read marks are this screen's only: a section is read once every file of its
 * part of the diff is marked Viewed (GitHub's own marks), or when its box is
 * ticked, which wins over the marks either way; never by moving past it. A
 * file shared by two sections is viewed for both. Give the stepper a `key`
 * per set of sections, so the ticks of one never carry over to another.
 */
export function DiffStepper({
  sections,
  layout,
  renderIntro,
  aside,
  stickyTop,
  renderDiff,
  viewedPaths,
}: DiffStepperProps): ReactNode {
  const [requestedKey, setRequestedKey] = useState<string | null>(null);
  const [ticked, setTicked] = useState<ReadonlyMap<string, boolean>>(new Map());
  const read = useMemo(() => {
    const viewed = new Set(viewedPaths);
    return new Set(
      sections.flatMap(({ key, patch }) => {
        const paths = diffPaths(patch);
        const allViewed =
          paths.length > 0 && paths.every((path) => viewed.has(path));
        return (ticked.get(key) ?? allViewed) ? [key] : [];
      }),
    );
  }, [sections, ticked, viewedPaths]);
  // the step navigation sticks under the toolbar, the file headers under it
  const [navigationHeight, setNavigationHeight] = useState(0);
  // moving on starts the next step at the stepper's top, under the intro
  const stepTop = useRef<ComponentRef<typeof View>>(null);
  const sectionElements = useRef(new Map<string, unknown>());
  const currentIndex = Math.max(
    0,
    sections.findIndex(({ key }) => key === requestedKey),
  );
  const current = sections[currentIndex] ?? null;

  const reveal = (element: unknown): void => {
    if (typeof HTMLElement !== "undefined" && element instanceof HTMLElement) {
      revealTopOf(element, stickyTop);
    }
  };

  const header = (section: DiffStepperSection): ReactNode => (
    <SectionHeader
      section={section}
      read={read.has(section.key)}
      onReadChange={(isRead) => {
        setTicked((previous) => new Map([...previous, [section.key, isRead]]));
      }}
    />
  );

  const goTo = (key: string): void => {
    setRequestedKey(key);
    reveal(
      layout === "stepper" ? stepTop.current : sectionElements.current.get(key),
    );
  };

  const plan = (
    <DiffStepperPlan
      sections={sections}
      current={current?.key ?? null}
      read={read}
      onSectionPress={goTo}
    />
  );

  const steps =
    layout === "stepper" && current !== null ? (
      <View ref={stepTop} className="gap-m">
        <View
          className="-mx-xs flex-row items-center justify-between gap-sm bg-screen px-xs py-xs web:sticky web:z-10"
          style={{ top: stickyTop }}
          onLayout={(event) => {
            setNavigationHeight(event.nativeEvent.layout.height);
          }}
        >
          <Button
            text="Previous step"
            accent="neutral"
            variant="tonal"
            size="sm"
            disabled={currentIndex === 0}
            onPress={() => {
              const previous = sections[currentIndex - 1];
              if (previous !== undefined) goTo(previous.key);
            }}
          />
          <Text className="text-sm text-muted">
            {`${String(currentIndex + 1)} / ${String(sections.length)}`}
          </Text>
          <Button
            text="Next step"
            accent="brand"
            variant="tonal"
            size="sm"
            disabled={currentIndex === sections.length - 1}
            onPress={() => {
              const next = sections[currentIndex + 1];
              if (next !== undefined) goTo(next.key);
            }}
          />
        </View>
        {header(current)}
        <SectionBody
          section={current}
          stickyTop={stickyTop + navigationHeight}
          renderDiff={renderDiff}
        />
      </View>
    ) : (
      <View className="gap-xl">
        {sections.map((section) => (
          <View
            key={section.key}
            ref={(element) => {
              sectionElements.current.set(section.key, element);
            }}
            className="gap-m"
          >
            {header(section)}
            <SectionBody
              section={section}
              stickyTop={stickyTop}
              renderDiff={renderDiff}
            />
          </View>
        ))}
      </View>
    );

  return (
    <View className="gap-m">
      {renderIntro?.(goTo)}
      <View className={aside ? "flex-row items-start gap-xl" : "gap-l"}>
        {aside ? (
          <View
            className="w-[280px] shrink-0 gap-sm web:sticky web:max-h-[calc(100vh-8rem)] web:overflow-y-auto"
            style={{ top: stickyTop }}
          >
            {plan}
          </View>
        ) : null}
        <View className="min-w-0 flex-1 gap-m">
          {aside ? null : plan}
          {steps}
        </View>
      </View>
    </View>
  );
}
