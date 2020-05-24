import { TeamSlack } from './TeamSlack';

export const voidTeamSlack = (): TeamSlack => ({
  mention: (): string => '',
  link: (): string => '',
  postMessage: (): Promise<null> => Promise.resolve(null),
  updateMessage: (): Promise<null> => Promise.resolve(null),
  deleteMessage: (): Promise<undefined> => Promise.resolve(undefined),
  addReaction: (): Promise<undefined> => Promise.resolve(undefined),
  prLink: (): string => '',
  updateHome: (): void => undefined,
});
