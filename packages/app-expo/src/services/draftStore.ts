import type { DraftStore } from "@reviewflow/ui";
import { createExpiringDraftStore } from "@reviewflow/ui";

const retentionDays = 7;

/**
 * Comments and reviews being written, kept in this browser's localStorage.
 * Undefined without it (native, or a browser refusing site data): drafts then
 * live as long as the screen.
 */
export const createLocalDraftStore = (): DraftStore | undefined => {
  try {
    const storage = globalThis.localStorage as Storage | undefined;
    if (storage === undefined) return undefined;
    return createExpiringDraftStore({ storage, retentionDays });
  } catch {
    return undefined;
  }
};
