import { randomBytes } from "node:crypto";
import {
  chmodSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  renameSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { basename, dirname, join } from "node:path";

export interface EditableFile {
  /** the text on disk; empty when the file does not exist */
  source: string;
  exists: boolean;
}

/**
 * What a caller's `validate` answers: `{ error }` refuses the save, `{ warnings }`
 * lets it through and travels back with the saved file.
 */
export type FileValidation = { error: string } | { warnings: string[] };

export type ValidateEditableFile = (
  source: string,
) => FileValidation | Promise<FileValidation>;

export interface SaveEditableFileParams {
  path: string;
  source: string;
  /**
   * What the editor opened on. `undefined` skips the check. A string is
   * refused when the file has other text now, a missing file counting as the
   * empty text so an editor opened on a file that did not exist can save it.
   * `null` means the file must not exist yet (a creation).
   */
  expectedSource?: string | null | undefined;
  validate: ValidateEditableFile;
  /**
   * End a non-empty source with a newline before it is validated and written.
   * Default true: a text file ends with one, and the editor then reopens on
   * the text that was saved.
   */
  trailingNewline?: boolean;
}

export type SaveEditableFileResult =
  /** nothing was written; `source` is what the disk holds now, for the UI to offer a reload */
  | { status: "conflict"; source: string; exists: boolean }
  /** nothing was written */
  | { status: "invalid"; error: string }
  /** `source` is what is on disk now, which may differ from the input by its final newline */
  | { status: "saved"; source: string; warnings: string[] };

const isMissing = (error: unknown): boolean =>
  (error as NodeJS.ErrnoException).code === "ENOENT";

const readCurrent = (path: string): string | null => {
  try {
    return readFileSync(path, "utf8");
  } catch (error) {
    if (isMissing(error)) return null;
    throw error;
  }
};

/**
 * The file as it is on disk right now. A missing file is a state, not an
 * error: `{ source: "", exists: false }`. Always read from disk, never from a
 * cache: a file edited in place by another tool must not make the next save
 * refuse because an editor opened on a stale copy.
 */
export const readEditableFile = (path: string): EditableFile => {
  const source = readCurrent(path);
  return source === null
    ? { source: "", exists: false }
    : { source, exists: true };
};

const validationOf = async (
  validate: ValidateEditableFile,
  source: string,
): Promise<FileValidation> => {
  try {
    return await validate(source);
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) };
  }
};

/**
 * Writes one text file. Every refusal comes before the write:
 *
 * - **A source `validate` refuses is not written**, whatever is on disk: only
 *   what is about to be written is checked, so a broken file can be fixed.
 * - **A file that changed since the editor opened it is refused**, with the
 *   text now on disk. The same file is edited by hand or by another tool, and
 *   the last writer winning would lose the other edit without either side
 *   seeing it.
 *
 * Written beside the target and renamed over it, so a crash leaves the previous
 * file rather than a truncated one; missing parent directories are created and
 * the mode of an existing file is kept. A symlink is written through to its
 * target: renaming over the link would replace it with a plain file and
 * quietly detach it from the repository that holds the real one.
 */
export const saveEditableFile = async ({
  path,
  source,
  expectedSource,
  validate,
  trailingNewline = true,
}: SaveEditableFileParams): Promise<SaveEditableFileResult> => {
  const text =
    trailingNewline && source !== "" && !source.endsWith("\n")
      ? `${source}\n`
      : source;

  const validation = await validationOf(validate, text);
  if ("error" in validation) {
    return { status: "invalid", error: validation.error };
  }

  const current = readCurrent(path);
  if (expectedSource !== undefined) {
    const conflicts =
      expectedSource === null
        ? current !== null
        : (current ?? "") !== expectedSource;
    if (conflicts) {
      return {
        status: "conflict",
        source: current ?? "",
        exists: current !== null,
      };
    }
  }

  mkdirSync(dirname(path), { recursive: true });
  const target = current === null ? path : realpathSync(path);
  const temporary = join(
    dirname(target),
    `.${basename(target)}.${String(process.pid)}.${randomBytes(4).toString("hex")}.tmp`,
  );
  try {
    writeFileSync(temporary, text);
    // the permission bits of the existing file, without its file-type bits
    // oxlint-disable-next-line no-bitwise
    if (current !== null) chmodSync(temporary, statSync(target).mode & 0o7777);
    renameSync(temporary, target);
  } catch (error) {
    try {
      unlinkSync(temporary);
    } catch {
      // the temporary file was never created
    }
    throw error;
  }

  return { status: "saved", source: text, warnings: validation.warnings };
};
