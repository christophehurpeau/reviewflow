import { optionsRegexps } from './prOptions';
import type { Options } from './prOptions';

export type { Options } from './prOptions';

export const parseOptions = (
  content: string,
  defaultOptions: Options,
): Options => {
  const options: Partial<Options> = {};

  optionsRegexps.forEach(({ key, regexp }) => {
    const match = regexp.exec(content);
    options[key] = !match
      ? defaultOptions[key] || false
      : match[1] === 'x' || match[1] === 'X';
  });

  return options as Options;
};

export const parseCommitNotes = (content: string): string => {
  const commitNotes = content.replace(
    /^.*#### Commits Notes:(.*)#### Options:.*$/s,
    '$1',
  );

  if (commitNotes === content) {
    return '';
  } else {
    return commitNotes.trim();
  }
};

export interface ParsedBody {
  options: Options;
  commitNotes: string;
}

export const parseBody = (
  content: string,
  defaultOptions: Options,
): ParsedBody => {
  return {
    options: parseOptions(content, defaultOptions),
    commitNotes: parseCommitNotes(content),
  };
};
