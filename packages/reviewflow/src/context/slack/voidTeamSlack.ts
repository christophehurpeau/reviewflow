import type { TeamSlack } from "./TeamSlack";

export const voidTeamSlack = (): TeamSlack => ({
  mention: (): string => "",
  postMessage: (): Promise<null> => Promise.resolve(null),
  updateMessage: (): Promise<null> => Promise.resolve(null),
  deleteMessage: (): Promise<undefined> => Promise.resolve(undefined),
  addReaction: (): Promise<undefined> => Promise.resolve(undefined),
  updateHome: (): void => undefined,
  updateSlackMember: (): Promise<undefined> => Promise.resolve(undefined),
  shouldShowLoginMessage: (): boolean => false,
});
