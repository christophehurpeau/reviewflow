import { pathOfBlock } from "./diffPaths.ts";

/**
 * A walkthrough reads a pull request as a narrative rather than in file
 * order: the problem with its source, the weak points the reviews and the
 * description raised and what was decided on each, then chapters of steps,
 * each one review idea and the hunks that implement it. It is read once the
 * review is done, so it asks the author nothing: what no source settled is
 * said as such, never turned into a question.
 *
 * Its writer (an agent) cites hunks by id, `<path>#<n>`, the n-th hunk of that
 * file in the diff `readWalkthroughDiff` reads: whitespace shown, the default
 * context. Checking a draft resolves every cited id to its lines on both
 * sides, which is what is stored and shown: a diff read another way (whitespace
 * hidden) has other hunks, and the ones overlapping a step's lines are its.
 */

export interface DiffWalkthroughHunk {
  path: string;
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
}

export interface DiffWalkthroughSource {
  label: string;
  url: string | null;
}

export interface DiffWalkthroughStatement {
  text: string;
  sources: DiffWalkthroughSource[];
}

export interface DiffWalkthroughNote {
  /** one of its step's hunk ids */
  hunk: string;
  text: string;
}

export interface DiffWalkthroughStep {
  id: string;
  title: string;
  /** markdown */
  explanation: string;
  /** hunk ids; a hunk sits in one step at most */
  hunks: string[];
  notes: DiffWalkthroughNote[];
  /** what the writer noticed while explaining the step: no defect is searched for */
  concerns: string[];
}

export interface DiffWalkthroughChapter {
  id: string;
  title: string;
  /**
   * markdown: what this part of the change does and why it comes at this
   * point of the reading; read together, the summaries say how the pull
   * request is split. Empty in a walkthrough written before it existed.
   */
  summary: string;
  steps: DiffWalkthroughStep[];
}

export interface DiffWalkthroughTicket {
  key: string;
  title: string | null;
  url: string | null;
}

/** A weak point a source raised (a review finding, a limit the description states) and what was decided on it. */
export interface DiffWalkthroughWeakness {
  /** markdown */
  text: string;
  /** fixed, accepted or declined, and why; null when no source records a decision */
  decision: string | null;
  sources: DiffWalkthroughSource[];
  /** ids of the steps where it, or its fix, is in the code */
  steps: string[];
}

/** What the writer submits. */
export interface DiffWalkthroughDraft {
  title: string;
  ticket: DiffWalkthroughTicket | null;
  problem: DiffWalkthroughStatement;
  weaknesses: DiffWalkthroughWeakness[];
  chapters: DiffWalkthroughChapter[];
}

/** A draft checked against the diff it cites. */
export interface DiffWalkthrough extends DiffWalkthroughDraft {
  version: 2;
  /** the range it was written on */
  head: string;
  base: string;
  /** ISO 8601 */
  writtenAt: string;
  /** every cited hunk's lines, by id */
  hunks: Record<string, DiffWalkthroughHunk>;
}

/**
 * `GET /api/prs/walkthrough?repo=<owner/repo>&number=<n>&head=<sha>&base=<sha>`
 * — the walkthrough written on that range, if any.
 */
export interface DiffWalkthroughResponse {
  walkthrough: DiffWalkthrough | null;
  /** ISO 8601: a walkthrough was asked for on this range and is not written yet */
  requestedAt: string | null;
  /**
   * The latest walkthrough of the pull request written on another range, while
   * none is on this one: the pull request moved since it was written.
   */
  older: { head: string; base: string; writtenAt: string } | null;
}

export interface PatchHunk extends DiffWalkthroughHunk {
  id: string;
  /** the `@@` line and its body, newline-joined */
  text: string;
}

export interface PatchFile {
  path: string;
  /** `diff --git` up to the first `@@`, newline-joined */
  header: string;
  /** none for a pure rename, a mode change or a binary file */
  hunks: PatchHunk[];
}

const hunkHeaderPattern = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/u;

export const walkthroughHunkId = (path: string, index: number): string =>
  `${path}#${String(index + 1)}`;

const hunksOfBody = (path: string, lines: readonly string[]): PatchHunk[] => {
  const hunks: PatchHunk[] = [];
  let current: { header: RegExpExecArray; lines: string[] } | null = null;
  const close = (): void => {
    if (current === null) return;
    const [, oldStart, oldLines, newStart, newLines] = current.header;
    hunks.push({
      id: walkthroughHunkId(path, hunks.length),
      path,
      oldStart: Number(oldStart),
      oldLines: oldLines === undefined ? 1 : Number(oldLines),
      newStart: Number(newStart),
      newLines: newLines === undefined ? 1 : Number(newLines),
      text: current.lines.join("\n"),
    });
  };
  for (const line of lines) {
    const header = hunkHeaderPattern.exec(line);
    if (header === null) {
      current?.lines.push(line);
      continue;
    }
    close();
    current = { header, lines: [line] };
  }
  close();
  return hunks;
};

const fileOfBlock = (block: string): PatchFile | null => {
  const path = pathOfBlock(block);
  if (path === null) return null;
  const lines = block.endsWith("\n")
    ? block.slice(0, -1).split("\n")
    : block.split("\n");
  const firstHunk = lines.findIndex((line) => hunkHeaderPattern.test(line));
  const headerEnd = firstHunk === -1 ? lines.length : firstHunk;
  return {
    path,
    header: lines.slice(0, headerEnd).join("\n"),
    hunks: hunksOfBody(path, lines.slice(headerEnd)),
  };
};

/** The files of a unified diff, each with its hunks. */
export const splitPatch = (patch: string): PatchFile[] =>
  patch
    .split(/^(?=diff --git )/mu)
    .filter((block) => block.startsWith("diff --git "))
    .flatMap((block) => fileOfBlock(block) ?? []);

const joinPatch = (files: readonly PatchFile[]): string =>
  files
    .map((file) =>
      [file.header, ...file.hunks.map(({ text }) => text)].join("\n"),
    )
    .map((text) => `${text}\n`)
    .join("");

/** A side's lines as a half-open span; an empty side still marks its place. */
const intersects = (
  aStart: number,
  aLines: number,
  bStart: number,
  bLines: number,
): boolean =>
  aStart < bStart + Math.max(bLines, 1) &&
  bStart < aStart + Math.max(aLines, 1);

export const hunksOverlap = (
  a: DiffWalkthroughHunk,
  b: DiffWalkthroughHunk,
): boolean =>
  a.path === b.path &&
  (intersects(a.newStart, a.newLines, b.newStart, b.newLines) ||
    intersects(a.oldStart, a.oldLines, b.oldStart, b.oldLines));

const overlapsAny = (
  hunk: DiffWalkthroughHunk,
  ranges: readonly DiffWalkthroughHunk[],
): boolean => ranges.some((range) => hunksOverlap(hunk, range));

/** The part of `patch` whose hunks overlap `ranges`, files in patch order. */
export const patchOfHunks = (
  patch: string,
  ranges: readonly DiffWalkthroughHunk[],
): string =>
  joinPatch(
    splitPatch(patch).flatMap((file) => {
      const hunks = file.hunks.filter((hunk) => overlapsAny(hunk, ranges));
      return hunks.length === 0 ? [] : [{ ...file, hunks }];
    }),
  );

/** The part of `patch` touching `paths`, files in patch order. */
export const patchOfPaths = (
  patch: string,
  paths: readonly string[],
): string => {
  const kept = new Set(paths);
  return joinPatch(splitPatch(patch).filter(({ path }) => kept.has(path)));
};

/**
 * The part of `patch` no range overlaps: what a walkthrough leaves out, the
 * files without a hunk (a pure rename, a binary file) included.
 */
export const patchOutsideHunks = (
  patch: string,
  ranges: readonly DiffWalkthroughHunk[],
): string =>
  joinPatch(
    splitPatch(patch).flatMap((file) => {
      if (file.hunks.length === 0) return [file];
      const hunks = file.hunks.filter((hunk) => !overlapsAny(hunk, ranges));
      return hunks.length === 0 ? [] : [{ ...file, hunks }];
    }),
  );

/** The ranges of a step's hunks; an id the walkthrough does not resolve is skipped. */
export const stepHunks = (
  walkthrough: DiffWalkthrough,
  step: DiffWalkthroughStep,
): DiffWalkthroughHunk[] =>
  step.hunks.flatMap((id) => walkthrough.hunks[id] ?? []);

export const walkthroughSteps = (
  walkthrough: DiffWalkthroughDraft,
): DiffWalkthroughStep[] => walkthrough.chapters.flatMap(({ steps }) => steps);

/**
 * The diff as the writer reads it: every hunk preceded by a `### hunk <id>`
 * line, the only valid references.
 */
export const annotatePatch = (patch: string): string =>
  splitPatch(patch)
    .map((file) =>
      [
        file.header,
        ...file.hunks.flatMap(({ id, text }) => [`### hunk ${id}`, text]),
      ].join("\n"),
    )
    .map((text) => `${text}\n`)
    .join("");

type Errors = string[];

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const checkKeys = (
  value: Record<string, unknown>,
  path: string,
  allowed: readonly string[],
  errors: Errors,
): void => {
  for (const key of Object.keys(value)) {
    if (!allowed.includes(key)) errors.push(`${path}.${key}: unknown key`);
  }
};

const checkText = (value: unknown, path: string, errors: Errors): void => {
  if (typeof value !== "string" || value.trim() === "") {
    errors.push(`${path}: a non-empty string is expected`);
  }
};

const checkNullableText = (
  value: unknown,
  path: string,
  errors: Errors,
): void => {
  if (value !== null) checkText(value, path, errors);
};

const checkList = (
  value: unknown,
  path: string,
  errors: Errors,
  checkItem: (item: unknown, itemPath: string) => void,
  { nonEmpty = false }: { nonEmpty?: boolean } = {},
): void => {
  if (!Array.isArray(value)) {
    errors.push(`${path}: an array is expected`);
    return;
  }
  if (nonEmpty && value.length === 0) {
    errors.push(`${path}: at least one item is expected`);
  }
  value.forEach((item: unknown, index) => {
    checkItem(item, `${path}[${String(index)}]`);
  });
};

const checkObject = (
  value: unknown,
  path: string,
  keys: readonly string[],
  errors: Errors,
  checkFields: (object: Record<string, unknown>) => void,
): void => {
  if (!isRecord(value)) {
    errors.push(`${path}: an object is expected`);
    return;
  }
  checkKeys(value, path, keys, errors);
  checkFields(value);
};

const checkStatement = (value: unknown, path: string, errors: Errors): void => {
  checkObject(value, path, ["text", "sources"], errors, (statement) => {
    checkText(statement.text, `${path}.text`, errors);
    checkList(
      statement.sources,
      `${path}.sources`,
      errors,
      (source, sourcePath) => {
        checkObject(source, sourcePath, ["label", "url"], errors, (fields) => {
          checkText(fields.label, `${sourcePath}.label`, errors);
          checkNullableText(fields.url, `${sourcePath}.url`, errors);
        });
      },
      { nonEmpty: true },
    );
  });
};

const checkWeakness = (
  value: unknown,
  path: string,
  stepIds: ReadonlySet<unknown>,
  errors: Errors,
): void => {
  checkObject(
    value,
    path,
    ["text", "decision", "sources", "steps"],
    errors,
    (weakness) => {
      checkText(weakness.text, `${path}.text`, errors);
      checkNullableText(weakness.decision, `${path}.decision`, errors);
      checkList(
        weakness.sources,
        `${path}.sources`,
        errors,
        (source, sourcePath) => {
          checkObject(
            source,
            sourcePath,
            ["label", "url"],
            errors,
            (fields) => {
              checkText(fields.label, `${sourcePath}.label`, errors);
              checkNullableText(fields.url, `${sourcePath}.url`, errors);
            },
          );
        },
        { nonEmpty: true },
      );
      checkList(weakness.steps, `${path}.steps`, errors, (step, stepPath) => {
        if (!stepIds.has(step)) {
          errors.push(`${stepPath}: ${String(step)} is no step id`);
        }
      });
    },
  );
};

interface StepContext {
  hunkIds: ReadonlySet<string>;
  placed: Map<string, string>;
  errors: Errors;
}

const checkStep = (
  value: unknown,
  path: string,
  context: StepContext,
): void => {
  const { errors } = context;
  checkObject(
    value,
    path,
    ["id", "title", "explanation", "hunks", "notes", "concerns"],
    errors,
    (step) => {
      checkText(step.id, `${path}.id`, errors);
      checkText(step.title, `${path}.title`, errors);
      checkText(step.explanation, `${path}.explanation`, errors);
      checkList(
        step.hunks,
        `${path}.hunks`,
        errors,
        (hunk, hunkPath) => {
          if (typeof hunk !== "string") {
            errors.push(`${hunkPath}: a hunk id is expected`);
            return;
          }
          if (!context.hunkIds.has(hunk)) {
            errors.push(`${hunkPath}: ${hunk} is no hunk of the diff`);
            return;
          }
          const placedIn = context.placed.get(hunk);
          if (placedIn !== undefined) {
            errors.push(`${hunkPath}: ${hunk} is already in ${placedIn}`);
            return;
          }
          context.placed.set(hunk, path);
        },
        { nonEmpty: true },
      );
      const stepHunkIds = Array.isArray(step.hunks) ? step.hunks : [];
      checkList(step.notes, `${path}.notes`, errors, (note, notePath) => {
        checkObject(note, notePath, ["hunk", "text"], errors, (fields) => {
          checkText(fields.text, `${notePath}.text`, errors);
          if (!stepHunkIds.includes(fields.hunk)) {
            errors.push(`${notePath}.hunk: not one of the step's hunks`);
          }
        });
      });
      checkList(step.concerns, `${path}.concerns`, errors, (concern, p) => {
        checkText(concern, p, errors);
      });
    },
  );
};

const checkUniqueIds = (
  ids: readonly unknown[],
  what: string,
  errors: Errors,
): void => {
  const seen = new Set<unknown>();
  for (const id of ids) {
    if (seen.has(id)) errors.push(`${what} id ${String(id)} is used twice`);
    seen.add(id);
  }
};

const idsOf = (items: unknown): unknown[] =>
  Array.isArray(items)
    ? items.flatMap((item: unknown) => (isRecord(item) ? [item.id] : []))
    : [];

const draftErrors = (
  candidate: unknown,
  hunkIds: ReadonlySet<string>,
): Errors => {
  const errors: Errors = [];
  const context: StepContext = { hunkIds, placed: new Map(), errors };
  checkObject(
    candidate,
    "walkthrough",
    ["title", "ticket", "problem", "weaknesses", "chapters"],
    errors,
    (draft) => {
      checkText(draft.title, "walkthrough.title", errors);
      if (draft.ticket !== null) {
        checkObject(
          draft.ticket,
          "walkthrough.ticket",
          ["key", "title", "url"],
          errors,
          (ticket) => {
            checkText(ticket.key, "walkthrough.ticket.key", errors);
            checkNullableText(ticket.title, "walkthrough.ticket.title", errors);
            checkNullableText(ticket.url, "walkthrough.ticket.url", errors);
          },
        );
      }
      checkStatement(draft.problem, "walkthrough.problem", errors);
      const stepIds = new Set(
        Array.isArray(draft.chapters)
          ? draft.chapters.flatMap((chapter: unknown) =>
              isRecord(chapter) ? idsOf(chapter.steps) : [],
            )
          : [],
      );
      checkList(
        draft.weaknesses,
        "walkthrough.weaknesses",
        errors,
        (item, p) => {
          checkWeakness(item, p, stepIds, errors);
        },
      );
      checkList(
        draft.chapters,
        "walkthrough.chapters",
        errors,
        (chapter, chapterPath) => {
          checkObject(
            chapter,
            chapterPath,
            ["id", "title", "summary", "steps"],
            errors,
            (fields) => {
              checkText(fields.id, `${chapterPath}.id`, errors);
              checkText(fields.title, `${chapterPath}.title`, errors);
              checkText(fields.summary, `${chapterPath}.summary`, errors);
              checkList(
                fields.steps,
                `${chapterPath}.steps`,
                errors,
                (step, stepPath) => {
                  checkStep(step, stepPath, context);
                },
                { nonEmpty: true },
              );
            },
          );
        },
        { nonEmpty: true },
      );
      checkUniqueIds(idsOf(draft.chapters), "chapter", errors);
      checkUniqueIds(
        Array.isArray(draft.chapters)
          ? draft.chapters.flatMap((chapter: unknown) =>
              isRecord(chapter) ? idsOf(chapter.steps) : [],
            )
          : [],
        "step",
        errors,
      );
    },
  );
  return errors;
};

export interface CompleteWalkthroughParams {
  /** the writer's draft, parsed JSON not checked yet */
  candidate: unknown;
  /** the diff `readWalkthroughDiff` read on that range */
  patch: string;
  head: string;
  base: string;
  writtenAt: string;
}

export type CompleteWalkthroughResult =
  | { walkthrough: DiffWalkthrough; errors: null }
  | { walkthrough: null; errors: string[] };

/**
 * Checks a draft against the diff it cites and resolves its hunk ids. Every
 * error is listed, so a writer fixes them all at once.
 */
export const completeWalkthrough = ({
  candidate,
  patch,
  head,
  base,
  writtenAt,
}: CompleteWalkthroughParams): CompleteWalkthroughResult => {
  const hunks = new Map(
    splitPatch(patch)
      .flatMap((file) => file.hunks)
      .map(({ id, path, oldStart, oldLines, newStart, newLines }) => [
        id,
        { path, oldStart, oldLines, newStart, newLines },
      ]),
  );
  const errors = draftErrors(candidate, new Set(hunks.keys()));
  if (errors.length > 0) return { walkthrough: null, errors };
  const draft = candidate as DiffWalkthroughDraft;
  const cited = new Set(walkthroughSteps(draft).flatMap((step) => step.hunks));
  return {
    walkthrough: {
      version: 2,
      head,
      base,
      writtenAt,
      title: draft.title,
      ticket: draft.ticket,
      problem: draft.problem,
      weaknesses: draft.weaknesses,
      chapters: draft.chapters,
      hunks: Object.fromEntries([...hunks].filter(([id]) => cited.has(id))),
    },
    errors: null,
  };
};

/** A chapter stored before summaries existed gets an empty one. */
const withChapterSummaries = (
  walkthrough: DiffWalkthrough,
): DiffWalkthrough => ({
  ...walkthrough,
  chapters: walkthrough.chapters.map((chapter) => ({
    ...chapter,
    summary: typeof chapter.summary === "string" ? chapter.summary : "",
  })),
});

/**
 * A stored walkthrough, read back: the first format's decisions and
 * questions are dropped, its weak points left empty, and a chapter without a
 * summary gets an empty one, rather than the whole walkthrough refused. Null
 * for anything else.
 */
export const readStoredWalkthrough = (
  value: unknown,
): DiffWalkthrough | null => {
  if (!isRecord(value)) return null;
  if (value.version === 2) {
    return withChapterSummaries(value as unknown as DiffWalkthrough);
  }
  if (value.version !== 1) return null;
  const { decisions: _decisions, questions: _questions, ...rest } = value;
  return withChapterSummaries({
    ...(rest as unknown as Omit<DiffWalkthrough, "version" | "weaknesses">),
    version: 2,
    weaknesses: [],
  });
};
