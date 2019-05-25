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

interface UpdatedBodyWithOptions {
  body: string;
  options?: Record<Options, boolean>;
}

export const updateBody = (
  body: string,
  defaultConfig: Record<Options, boolean>,
  infos?: StatusInfo[],
): UpdatedBodyWithOptions => {
  const parsed = parseBody(body, defaultConfig);
  if (!parsed) {
    console.info('could not parse body');
    return { body };
  }
  const {
    content,
    reviewflowContentColPrefix,
    reviewflowContentColSuffix,
    options,
  } = parsed;

  return {
    options: parsed.options,
    body: `${content}${reviewflowContentColPrefix}
${
  infos && infos.length !== 0 ? `#### Infos:\n${toMarkdownInfos(infos)}\n` : ''
}#### Options:
${toMarkdownOptions(options)}
${reviewflowContentColSuffix}
`,
  };
};
