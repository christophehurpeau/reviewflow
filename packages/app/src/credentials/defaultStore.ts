import { createKeychainCredentialKey } from "./keychain.ts";
import type { CredentialStore } from "./store.ts";
import { createFileCredentialStore } from "./store.ts";

let instance: CredentialStore | null = null;

/** One instance for the process, so the keychain is asked for the key once. */
export const defaultCredentialStore = (): CredentialStore => {
  instance ??= createFileCredentialStore(createKeychainCredentialKey());
  return instance;
};
