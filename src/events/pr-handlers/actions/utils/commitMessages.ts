import commitlintConventionalConfig from "@commitlint/config-conventional";
import * as commitlintLintModule from "@commitlint/lint";
import * as commitlintParseModule from "@commitlint/parse";
// @ts-expect-error missing typings
// eslint-disable-next-line import/no-unresolved
import createConventionalCommitsConfig from "conventional-changelog-conventionalcommits";
import type { AsyncReturnType } from "type-fest";

const conventionalCommitsConfig = await createConventionalCommitsConfig({});

const commitlintConventionalConfigTweakedRules: Parameters<
  typeof commitlintLint
>[1] = {
  ...commitlintConventionalConfig.rules,
  "header-max-length": [0],
};

export type ParsedCommit = AsyncReturnType<typeof commitlintParse>;

export const commitlintParse = ((commitlintParseModule.default as any)
  .default ||
  commitlintParseModule.default) as typeof commitlintParseModule.default;

export const commitlintLint = ((commitlintLintModule.default as any).default ||
  commitlintLintModule.default) as typeof commitlintLintModule.default;

export const parseCommitMessage = (
  message: string,
): ReturnType<typeof commitlintParse> => {
  return commitlintParse(message, undefined, conventionalCommitsConfig.parser);
};

export const lintCommitMessage = (
  message: string,
): ReturnType<typeof commitlintLint> => {
  return commitlintLint(message, commitlintConventionalConfigTweakedRules, {
    parserOpts: conventionalCommitsConfig.parser,
  });
};
