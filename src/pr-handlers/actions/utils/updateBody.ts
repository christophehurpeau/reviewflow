import { StatusInfo } from '../../../teamconfigs/types';
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

export const updateBody = (
  description: string,
  defaultConfig: Record<Options, boolean>,
  infos?: StatusInfo[],
) => {
  const parsed = parseBody(description, defaultConfig);
  if (!parsed) {
    console.info('could not parse body');
    return description;
  }
  const {
    content,
    reviewflowContentColPrefix,
    reviewflowContentColSuffix,
    options,
  } = parsed;

  return `${content}${reviewflowContentColPrefix}
${
  infos && infos.length !== 0 ? `#### Infos:\n${toMarkdownInfos(infos)}\n` : ''
}#### Options:
${toMarkdownOptions(options)}
${reviewflowContentColSuffix}
`;
};
