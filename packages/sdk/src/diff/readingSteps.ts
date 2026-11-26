import { isAttachablePath, isTypescriptPath } from "./readingOrder.ts";
import type {
  DiffReadingFile,
  DiffReadingGroup,
  DiffReadingOrderResponse,
} from "./types.ts";

export interface DiffReadingStep {
  key: string;
  /** the package, as `DiffReadingGroup.name` */
  group: string;
  /**
   * The entry point the step starts from, with the changed files it imports
   * and their tests after it. Null for the package's files no entry point
   * reaches: a file importing no changed file and imported by none, a file
   * that is not TypeScript, a test covering no changed file.
   */
  entry: string | null;
  /** in reading order, as the group lists them */
  files: DiffReadingFile[];
}

const isCodePath = (path: string): boolean =>
  isTypescriptPath(path) && !isAttachablePath(path);

/**
 * The reading order lists a package's entry points first, each followed by
 * what it reaches, then the roots reaching nothing. A file only a cycle
 * imports comes after them all; with no such root before it, nothing tells it
 * apart from the last entry point's files, and it joins that step.
 */
const stepsOfGroup = ({ name, files }: DiffReadingGroup): DiffReadingStep[] => {
  const steps: DiffReadingStep[] = [];
  const others: DiffReadingFile[] = [];
  let current: DiffReadingStep | null = null;
  for (const file of files) {
    if (isCodePath(file.path) && file.entry) {
      current = {
        key: `entry:${file.path}`,
        group: name,
        entry: file.path,
        files: [file],
      };
      steps.push(current);
    } else if (isCodePath(file.path) && !file.root && current !== null) {
      current.files.push(file);
    } else {
      current = null;
      others.push(file);
    }
  }
  if (others.length === 0) return steps;
  return [
    ...steps,
    { key: `others:${name}`, group: name, entry: null, files: others },
  ];
};

/** The reading order cut into steps: one per entry point, then each package's other files. */
export const readingStepsOf = (
  readingOrder: DiffReadingOrderResponse,
): DiffReadingStep[] => readingOrder.groups.flatMap(stepsOfGroup);

/** Every path of the step, its tests and stories included. */
export const readingStepPaths = ({ files }: DiffReadingStep): string[] =>
  files.flatMap(({ path, attached }) => [path, ...attached]);

/** The reading order narrowed to one step, for a viewer that lays files out by it. */
export const readingOrderOfStep = ({
  group,
  files,
}: DiffReadingStep): DiffReadingOrderResponse => ({
  groups: [{ name: group, files }],
});
