// @ts-expect-error missing typings
import commitlintConventialConfig from '@commitlint/config-conventional';
import * as commitlintLintModule from '@commitlint/lint';
import * as commitlintParseModule from '@commitlint/parse';
// @ts-expect-error missing typings
import createConventionalCommitsConfig from 'conventional-changelog-conventionalcommits';

const conventionalCommitsConfig = await createConventionalCommitsConfig({});

export const commitlintParse = (
  (commitlintParseModule.default as any).default
    ? (commitlintParseModule.default as any).default
    : commitlintParseModule.default
) as typeof commitlintParseModule.default;

export const commitlintLint = (
  (commitlintLintModule.default as any).default
    ? (commitlintLintModule.default as any).default
    : commitlintLintModule.default
) as typeof commitlintLintModule.default;

export const parseCommitMessage = (
  message: string,
): ReturnType<typeof commitlintParse> => {
  return commitlintParse(
    message,
    undefined,
    conventionalCommitsConfig.parserOpts,
  );
};

export const lintCommitMessage = (
  message: string,
): ReturnType<typeof commitlintLint> => {
  return commitlintLint(message, commitlintConventialConfig.rules);
};
