import { Context } from 'probot';

export const getKeys = <T extends {}>(o: T): (keyof T)[] =>
  Object.keys(o) as (keyof T)[];

export const contextIssue = <T>(
  context: Context,
  object?: T,
): {
  owner: string;
  repo: string;
  issue_number: number;
} & T => {
  const payload = context.payload;
  return context.repo({
    ...object,
    issue_number: (payload.issue || payload.pull_request || payload).number,
  }) as {
    owner: string;
    repo: string;
    issue_number: number;
  } & T;
};

export const contextPr = <T>(
  context: Context,
  object?: T,
): {
  owner: string;
  repo: string;
  pull_number: number;
} & T => {
  const payload = context.payload;
  return context.repo({
    ...object,
    pull_number: (payload.issue || payload.pull_request || payload).number,
  }) as {
    owner: string;
    repo: string;
    pull_number: number;
  } & T;
};
