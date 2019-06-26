import { StatusInfo } from '../../../orgsConfigs/types';
import { parseBody } from './parseBody';
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

export const updateBody = (
  body: string,
  defaultConfig: Record<Options, boolean>,
  infos?: StatusInfo[],
  updateOptions?: Partial<Record<Options, boolean>>,
): UpdatedBodyWithOptions => {
  const parsed = parseBody(body, defaultConfig);
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

  // eslint-disable-next-line no-nested-ternary
  const infosParagraph = !infos
    ? reviewflowContentCol.replace(
        // eslint-disable-next-line unicorn/no-unsafe-regex
        /^\s*(?:(#### Infos:.*)?#### Options:)?.*$/s,
        '$1',
      )
    : infos.length !== 0
    ? `#### Infos:\n${toMarkdownInfos(infos)}\n`
    : '';

  const updatedOptions = !updateOptions
    ? options
    : { ...options, ...updateOptions };

  return {
    options: updatedOptions,
    body: `${content}${reviewflowContentColPrefix}
${infosParagraph}#### Options:
${toMarkdownOptions(updatedOptions)}
${reviewflowContentColSuffix}${ending || ''}`,
  };
};
