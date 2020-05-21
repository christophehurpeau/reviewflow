import issueParser from 'issue-parser';

const parse = issueParser('github', { actions: {}, issuePrefixes: [] });

export const parseMentions = (body: string): readonly string[] => {
  return parse(body).mentions.map((m) => m.user);
};
