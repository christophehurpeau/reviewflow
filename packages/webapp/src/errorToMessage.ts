export function errorToMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (error == null) return "";
  // eslint-disable-next-line @typescript-eslint/no-base-to-string
  return String(error);
}
