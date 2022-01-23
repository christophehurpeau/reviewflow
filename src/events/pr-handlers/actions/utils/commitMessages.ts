import * as commitlintParseModule from '@commitlint/parse';
// @ts-expect-error missing typings
import createConventionalCommitsConfig from 'conventional-changelog-conventionalcommits';

const conventionalCommitsConfig = await createConventionalCommitsConfig({});

export const commitlintParse = (
  (commitlintParseModule.default as any).default
    ? (commitlintParseModule.default as any).default
    : commitlintParseModule.default
) as typeof commitlintParseModule.default;

export const parseCommitMessage = (
  message: string,
): ReturnType<typeof commitlintParse> => {
  return commitlintParse(
    message,
    undefined,
    conventionalCommitsConfig.parserOpts,
  );
};
