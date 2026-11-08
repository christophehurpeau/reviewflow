/**
 * Node-only surface: a text file edited in place, read from disk and saved
 * atomically behind a validation and a changed-since-opened check. Import it
 * as `@reviewflow/sdk/files`; the root entry stays browser-safe.
 */
export { readEditableFile, saveEditableFile } from "./files/editableFile.ts";
export type {
  EditableFile,
  FileValidation,
  SaveEditableFileParams,
  SaveEditableFileResult,
  ValidateEditableFile,
} from "./files/editableFile.ts";
