/** One JSON object per line on stdout. Callers never pass the GitHub token. */
export const log = (
  level: "error" | "info" | "warn",
  message: string,
  fields: Record<string, unknown> = {},
): void => {
  console.log(
    JSON.stringify({
      time: new Date().toISOString(),
      level,
      message,
      ...fields,
    }),
  );
};

export const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);
