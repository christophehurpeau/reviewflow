import type { StatusInfo } from 'accountConfigs/types';
import type { Options } from './parseBody';
import { parseOptions } from './parseBody';
import { optionsLabels } from './prOptions';

export const defaultCommentBody = 'This will be auto filled by reviewflow.';

const toMarkdownOptions = (options: Options) => {
  return optionsLabels
    .map(
      ({ key, label }) =>
        `- [${options[key] ? 'x' : ' '}] <!-- reviewflow-${key} -->${label}`,
    )
    .join('\n');
};

const toMarkdownInfos = (infos: StatusInfo[]): string => {
  return infos
    .map((info) => {
      if (info.url) return `[${info.title}](${info.url})`;
      return info.title;
    })
    .join('\n');
};

interface UpdatedBodyWithOptions {
  commentBody: string;
  options?: Options;
}

const getReplacement = (infos?: StatusInfo[]): string => {
  if (!infos) return '$1$2';
  return infos.length > 0
    ? `#### Infos:\n\n${toMarkdownInfos(infos)}\n\n$2`
    : '$2';
};

const updateOptions = (
  options: Options,
  optionsToUpdate?: Partial<Options>,
): Options => {
  if (!optionsToUpdate) return options;
  return { ...options, ...optionsToUpdate };
};

const internalUpdateBodyOptionsAndInfos = (
  body: string,
  options: Options,
  infos?: StatusInfo[],
): string => {
  const infosAndCommitNotesParagraph = body.replace(
    // eslint-disable-next-line unicorn/no-unsafe-regex
    /^\s*(?:(#### Infos:.*)?(#### Commits Notes:.*)?#### Options:)?.*$/s,
    getReplacement(infos),
  );

  return `${infosAndCommitNotesParagraph}#### Options:\n${toMarkdownOptions(
    options,
  )}`;
};

export const createCommentBody = (
  defaultOptions: Options,
  infos?: StatusInfo[],
): string => {
  return internalUpdateBodyOptionsAndInfos('', defaultOptions, infos);
};

export const updateCommentOptions = (
  commentBody: string,
  defaultOptions: Options,
  optionsToUpdate?: Partial<Options>,
): UpdatedBodyWithOptions => {
  const options = parseOptions(commentBody, defaultOptions);
  const updatedOptions = updateOptions(options, optionsToUpdate);

  return {
    options: updatedOptions,
    commentBody: internalUpdateBodyOptionsAndInfos(commentBody, updatedOptions),
  };
};

export const updateCommentBodyInfos = (
  commentBody: string,
  infos?: StatusInfo[],
): string => {
  return commentBody.replace(
    // *  - zero or more
    // *? - zero or more (non-greedy)
    // eslint-disable-next-line unicorn/no-unsafe-regex
    /^\s*(?:(#### Infos:.*?)?(#### Commits Notes:.*?)?(#### Options:.*?)?)?$/s,
    `${getReplacement(infos)}$3`,
  );
};

export const updateCommentBodyCommitsNotes = (
  commentBody: string,
  commitNotes?: string,
): string => {
  return commentBody.replace(
    // eslint-disable-next-line unicorn/no-unsafe-regex
    /(?:#### Commits Notes:.*?)?(#### Options:)/s,
    // eslint-disable-next-line no-nested-ternary
    !commitNotes ? '$1' : `#### Commits Notes:\n\n${commitNotes}\n\n$1`,
  );
};

export const removeDeprecatedReviewflowInPrBody = (prBody: string): string => {
  return prBody.replace(
    // eslint-disable-next-line unicorn/no-unsafe-regex
    /^(.*)<!---? do not edit after this -?-->(.*)<!---? end - don't add anything after this -?-->(.*)$/is,
    // eslint-disable-next-line no-nested-ternary
    '$1$3',
  );
};
