import type { Options } from './parseBody';
import { parseBody } from './parseBody';

const commentStart = '<!-- do not edit after this -->';
const commentEnd = "<!-- end - don't add anything after this -->";

const regexpCols =
  /^(.*)(<!---? do not edit after this -?-->(.*)<!---? end - don't add anything after this -?-->)(.*)$/is;
const regexpReviewflowCol =
  /^(\s*<!---? do not edit after this -?--><\/td><td [^>]*>)\s*(.*)\s*(<\/td><\/tr><\/table>\s*<!---? end - don't add anything after this -?-->)\s*$/is;

interface ParsePrBodyResultWithoutOptions {
  content: string;
  ending: string;
  reviewflowContentCol: string;
  reviewflowContentColPrefix: string;
  reviewflowContentColSuffix: string;
}

interface ParsePrBodyResultWithOptions extends ParsePrBodyResultWithoutOptions {
  options: Options;
  commitNotes: string;
}

export const parsePrBody = (
  description: string,
): ParsePrBodyResultWithoutOptions | null => {
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

export const parsePrBodyWithOptions = (
  description: string,
  defaultOptions: Options,
): ParsePrBodyResultWithOptions | null => {
  const parsedPrBody = parsePrBody(description);
  if (parsedPrBody === null) return null;

  return {
    ...parsedPrBody,
    ...parseBody(parsedPrBody.reviewflowContentCol, defaultOptions),
  };
};
