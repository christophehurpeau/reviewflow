import { createFileCredentialKey } from "./keyFile.ts";
import { createKeychainCredentialKey } from "./keychain.ts";
import type { CredentialStore } from "./store.ts";
import { createFileCredentialStore } from "./store.ts";

let instance: CredentialStore | null = null;

/** One instance for the process, so the key is read once. */
export const defaultCredentialStore = (): CredentialStore => {
  instance ??= createFileCredentialStore(
    process.platform === "darwin"
      ? createKeychainCredentialKey()
      : createFileCredentialKey(),
  );
  return instance;
};
