import type { LabelList, StatusInfo } from 'accountConfigs/types';
import type { Options } from './parseBody';
import { parseActions, parseOptions } from './parseBody';
import type { ActionKeys } from './prActions';
import { actionDescriptions } from './prActions';
import { optionsDescriptions } from './prOptions';

export const defaultCommentBody = 'This will be auto filled by reviewflow.';

const toMarkdownOptions = (
  repoLink: string,
  labelsConfig: LabelList,
  options: Options,
): string => {
  return optionsDescriptions
    .map(({ key, labelKey, description, icon: iconValue }) => {
      const checkboxWithId = `[${
        options[key] ? 'x' : ' '
      }] <!-- reviewflow-${key} -->`;

      const labelDescription = labelKey && labelsConfig[labelKey];
      const labelLink = labelDescription
        ? `[${labelDescription.name}](${repoLink}/labels/${encodeURIComponent(
            labelDescription.name,
          )}): `
        : '';
      const icon = labelLink || !iconValue ? '' : `${iconValue} `;

      return `- ${checkboxWithId}${icon}${labelLink}${description}`;
    })
    .join('\n');
};

const toMarkdownActions = (
  repoLink: string,
  labelsConfig: LabelList,
): string => {
  return actionDescriptions
    .map(({ key, labelKey, description, icon: iconValue }) => {
      // should always update without ticking the box
      const checkboxWithId = `[ ] <!-- reviewflow-${key} -->`;

      const labelDescription = labelKey && labelsConfig[labelKey];
      const labelLink = labelDescription
        ? `[${labelDescription.name}](${repoLink}/labels/${encodeURIComponent(
            labelDescription.name,
          )}): `
        : '';
      const icon = labelLink || !iconValue ? '' : `${iconValue} `;

      return `- ${checkboxWithId}${icon}${labelLink}${description}`;
    })
    .join('\n');
};

const toMarkdownInfos = (infos: StatusInfo[]): string => {
  return infos
    .map((info) => {
      if (info.url) return `[${info.title}](${info.url})`;
      return info.title;
    })
    .join('\n\n');
};

interface UpdatedBodyWithOptions {
  commentBody: string;
  options?: Options;
  actions: ActionKeys[];
}

const getInfosReplacement = (infos?: StatusInfo[]): string => {
  if (!infos) return '$1$2';
  return infos.length > 0
    ? `### Infos:\n\n${toMarkdownInfos(infos)}\n\n$2`
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
  repoLink: string,
  labelsConfig: LabelList,
  body: string,
  options: Options,
  infos?: StatusInfo[],
): string => {
  const infosAndCommitNotesParagraph = body.replace(
    // eslint-disable-next-line unicorn/no-unsafe-regex
    /^\s*(?:(####? Infos:.*)?(####? Commits Notes:.*)?####? Options:)?.*$/s,
    getInfosReplacement(infos),
  );

  return `${infosAndCommitNotesParagraph}### Options:\n${toMarkdownOptions(
    repoLink,
    labelsConfig,
    options,
  )}\n### Actions:\n${toMarkdownActions(repoLink, labelsConfig)}`;
};

export const createCommentBody = (
  repoLink: string,
  labelsConfig: LabelList,
  defaultOptions: Options,
  infos?: StatusInfo[],
): string => {
  return internalUpdateBodyOptionsAndInfos(
    repoLink,
    labelsConfig,
    '',
    defaultOptions,
    infos,
  );
};

export const updateCommentOptions = (
  repoLink: string,
  labelsConfig: LabelList,
  commentBody: string,
  defaultOptions: Options,
  optionsToUpdate?: Partial<Options>,
): UpdatedBodyWithOptions => {
  const options = parseOptions(commentBody, defaultOptions);
  const updatedOptions = updateOptions(options, optionsToUpdate);

  return {
    options: updatedOptions,
    actions: parseActions(commentBody),
    commentBody: internalUpdateBodyOptionsAndInfos(
      repoLink,
      labelsConfig,
      commentBody,
      updatedOptions,
    ),
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
    /^\s*(?:(####? Infos:.*?)?(####? Commits Notes:.*?)?(####? Options:.*?)?)?$/s,
    `${getInfosReplacement(infos)}$3`,
  );
};

export const updateCommentBodyCommitsNotes = (
  commentBody: string,
  commitNotes?: string,
): string => {
  return commentBody.replace(
    // eslint-disable-next-line unicorn/no-unsafe-regex
    /(?:####? Commits Notes:.*?)?(####? Options:)/s,
    !commitNotes ? '$1' : `### Commits Notes:\n\n${commitNotes}\n\n$1`,
  );
};

export const removeDeprecatedReviewflowInPrBody = (
  prBody: string | null,
): string => {
  if (!prBody) return '';
  return prBody.replace(
    /^(.*)<!---? do not edit after this -?-->(.*)<!---? end - don't add anything after this -?-->(.*)$/is,
    '$1$3',
  );
};
