import type { Org } from "reviewflow-core";

// `syncOrg` upserts orgs without a config: absent on those documents
export const orgAllowsPersonalTokens = (org: Org): boolean =>
  (org.config as Org["config"] | undefined)?.allowPersonalTokens ?? false;
