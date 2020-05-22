import { StatusInfo } from '../../../accountConfigs/types';
import { parseBodyWithOptions, parseBody } from './parseBody';
import { Options, optionsLabels } from './prOptions';

const toMarkdownOptions = (options: Record<Options, boolean>) => {
  return optionsLabels
    .map(
      ({ name, label }) =>
        `- [${options[name] ? 'x' : ' '}] <!-- reviewflow-${name} -->${label}`,
    )
    .join('\n');
};

const toMarkdownInfos = (infos: StatusInfo[]) => {
  return infos
    .map((info) => {
      if (info.url) return `[${info.title}](${info.url})`;
      return info.title;
    })
    .join('\n');
};

interface UpdatedBodyWithOptions {
  body: string;
  options?: Record<Options, boolean>;
}

const getReplacement = (infos?: StatusInfo[]): string => {
  if (!infos) return '$1$2';
  return infos.length !== 0
    ? `#### Infos:\n${toMarkdownInfos(infos)}\n$2`
    : '$2';
};

export const updateBody = (
  body: string,
  defaultConfig: Record<Options, boolean>,
  infos?: StatusInfo[],
  updateOptions?: Partial<Record<Options, boolean>>,
): UpdatedBodyWithOptions => {
  const parsed = parseBodyWithOptions(body, defaultConfig);
  if (!parsed) {
    console.info('could not parse body');
    return { body };
  }
  const {
    content,
    ending,
    reviewflowContentCol,
    reviewflowContentColPrefix,
    reviewflowContentColSuffix,
    options,
  } = parsed;

  const infosAndCommitNotesParagraph = reviewflowContentCol.replace(
    // eslint-disable-next-line unicorn/no-unsafe-regex
    /^\s*(?:(#### Infos:.*)?(#### Commits Notes:.*)?#### Options:)?.*$/s,
    getReplacement(infos),
  );

  const updatedOptions = !updateOptions
    ? options
    : { ...options, ...updateOptions };

  return {
    options: updatedOptions,
    body: `${content}${reviewflowContentColPrefix}
${infosAndCommitNotesParagraph}#### Options:
${toMarkdownOptions(updatedOptions)}
${reviewflowContentColSuffix}${ending || ''}`,
  };
};

export const updateBodyCommitsNotes = (
  body: string,
  commitNotes?: string,
): string => {
  const parsed = parseBody(body);
  if (!parsed) {
    console.info('could not parse body');
    return body;
  }

  const {
    content,
    ending,
    reviewflowContentCol,
    reviewflowContentColPrefix,
    reviewflowContentColSuffix,
  } = parsed;

  const reviewflowContentColReplaced = reviewflowContentCol.replace(
    // eslint-disable-next-line unicorn/no-unsafe-regex
    /(?:#### Commits Notes:.*)?(#### Options:)/s,
    // eslint-disable-next-line no-nested-ternary
    !commitNotes ? '$1' : `#### Commits Notes:\n\n${commitNotes}\n\n$1`,
  );

  return `${content}${reviewflowContentColPrefix}${reviewflowContentColReplaced}${reviewflowContentColSuffix}${
    ending || ''
  }`;
};
