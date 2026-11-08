import { randomBytes } from "node:crypto";
import type { CredentialKey } from "./store.ts";

export interface MemoryCredentialKey extends CredentialKey {
  readonly created: number;
}

/** Stands in for the login keychain in tests, which never touch it. */
export const createMemoryCredentialKey = (
  initial: Buffer | null = null,
): MemoryCredentialKey => {
  const state = { key: initial, created: 0 };
  return {
    read: () => state.key,
    create: () => {
      state.key = randomBytes(32);
      state.created++;
      return state.key;
    },
    get created() {
      return state.created;
    },
  };
};
