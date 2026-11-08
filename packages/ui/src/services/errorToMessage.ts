import { FormValidationError } from "alouette";

export const errorToMessage = (error: unknown): string => {
  if (error instanceof FormValidationError) return "Fix the errors above.";
  return error instanceof Error ? error.message : String(error);
};
