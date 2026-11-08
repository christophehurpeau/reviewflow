export function errorToMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (error == null) return "";
  // oxlint-disable-next-line typescript/no-base-to-string
  return String(error);
}
