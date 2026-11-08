import type { EditableFileSaveResult } from "@reviewflow/ui";
import type { QueryClient } from "@tanstack/react-query";
import { getJson, requestAnswer } from "./api.ts";

export interface ConfigFile {
  path: string;
  source: string;
  exists: boolean;
}

export const configFileKey = ["config", "file"] as const;
export const repoAttachmentKey = (ownerRepo: string) =>
  ["config", "repo", ownerRepo] as const;

export const readConfigFile = (): Promise<ConfigFile> =>
  getJson<ConfigFile>("/api/config/file");

/**
 * Saves the config text. The server's three answers are the three results the
 * editor shows: saved (with warnings), refused (`{ error }`, 400) and changed
 * on disk (`{ conflict }`, 409). A saved file changes what every repository's
 * banner and every refused diff says, so those are read again.
 */
export const saveConfigFile = async (
  client: QueryClient,
  source: string,
  expectedSource: string,
): Promise<EditableFileSaveResult> => {
  const { status, body } = await requestAnswer("PUT", "/api/config/file", {
    source,
    expectedSource,
  });
  const answer = (body ?? {}) as {
    error?: unknown;
    conflict?: { source?: unknown };
    source?: unknown;
    warnings?: unknown;
  };
  if (status === 409 && typeof answer.conflict?.source === "string") {
    return { status: "conflict", source: answer.conflict.source };
  }
  if (typeof answer.error === "string") {
    return { status: "invalid", error: answer.error };
  }
  if (status !== 200 || typeof answer.source !== "string") {
    throw new Error(`saving the config failed: ${String(status)}`);
  }
  const saved = {
    path: (body as ConfigFile).path,
    source: answer.source,
    exists: true,
  };
  client.setQueryData(configFileKey, saved);
  await client.invalidateQueries({ queryKey: ["config", "repo"] });
  await client.invalidateQueries({
    predicate: ({ queryKey }) =>
      queryKey[0] === "pullRequest" && queryKey[3] === "diff",
  });
  return {
    status: "saved",
    source: answer.source,
    warnings: Array.isArray(answer.warnings)
      ? answer.warnings.filter((w): w is string => typeof w === "string")
      : [],
  };
};
