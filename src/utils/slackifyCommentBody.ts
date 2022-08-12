import slackifyMarkdown from 'slackify-markdown';

export const slackifyCommentBody = (
  body: string,
  multipleLines: boolean,
): string => {
  return slackifyMarkdown(
    body
      .replace('```suggestion', '_Suggested change:_\n```suggestion')
      .replace(
        '```suggestion\r\n```',
        `_Suggestion to remove line${multipleLines ? 's' : ''}._\n`,
      )
      .slice(0, 3000),
  );
};
