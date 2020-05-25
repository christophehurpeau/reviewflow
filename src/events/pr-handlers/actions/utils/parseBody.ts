import { Options, optionsRegexps } from './prOptions';

const commentStart = '<!-- do not edit after this -->';
const commentEnd = "<!-- end - don't add anything after this -->";

const regexpCols = /^(.*)(<!---? do not edit after this -?-->(.*)<!---? end - don't add anything after this -?-->)(.*)$/is;
const regexpReviewflowCol = /^(\s*<!---? do not edit after this -?--><\/td><td [^>]*>)\s*(.*)\s*(<\/td><\/tr><\/table>\s*<!---? end - don't add anything after this -?-->)\s*$/is;

type Config = Record<Options, boolean>;

const parseOptions = (content: string, defaultConfig: Config): Config => {
  return optionsRegexps.reduce((acc, { name, regexp }) => {
    const match = regexp.exec(content);
    acc[name] = !match
      ? defaultConfig[name] || false
      : match[1] === 'x' || match[1] === 'X';
    return acc;
  }, {} as any) as Config;
};

interface ParseBodyResultWithoutOptions {
  content: string;
  ending: string;
  reviewflowContentCol: string;
  reviewflowContentColPrefix: string;
  reviewflowContentColSuffix: string;
}

interface ParseBodyResultWithOptions extends ParseBodyResultWithoutOptions {
  options: Config;
  breakingChanges: string;
}

export const parseBody = (
  description: string,
): ParseBodyResultWithoutOptions | null => {
  const match = regexpCols.exec(description);
  if (!match) return null;
  const [, content, reviewFlowCol, reviewflowContent, ending] = match;
  const reviewFlowColMatch = regexpReviewflowCol.exec(reviewFlowCol);
  if (!reviewFlowColMatch) {
    return {
      content,
      ending,
      reviewflowContentCol: reviewflowContent,
      reviewflowContentColPrefix: commentStart,
      reviewflowContentColSuffix: commentEnd,
    };
  }
  const [
    ,
    reviewflowContentColPrefix,
    reviewflowContentCol,
    reviewflowContentColSuffix,
  ] = reviewFlowColMatch;

  return {
    content,
    ending,
    reviewflowContentCol,
    reviewflowContentColPrefix,
    reviewflowContentColSuffix,
  };
};

export const parseBodyWithOptions = (
  description: string,
  defaultConfig: Config,
): ParseBodyResultWithOptions | null => {
  const parsedBody = parseBody(description);
  if (parsedBody === null) return null;

  // console.log(parsedBody.reviewflowContentCol);
  let breakingChanges = parsedBody.reviewflowContentCol.replace(
    /^.*#### Commits Notes:(.*)#### Options:.*$/s,
    '$1',
  );

  if (breakingChanges === parsedBody.reviewflowContentCol) {
    breakingChanges = '';
  } else {
    breakingChanges = breakingChanges.trim();
  }

  return {
    ...parsedBody,
    options: parseOptions(parsedBody.reviewflowContentCol, defaultConfig),
    breakingChanges,
  };
};
