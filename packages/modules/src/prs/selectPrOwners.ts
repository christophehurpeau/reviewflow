import type { PrSummary, PrUserSummary } from "./Pr.ts";

export interface PrOwners {
  /** everyone the label names, in the order it names them */
  users: PrUserSummary[];
  label: string;
}

interface SelectPrOwnersOptions {
  currentUserLogin: string | undefined;
  /** how the viewer is named; slack italicises it */
  selfLabel?: string;
}

const formatLogins = (
  users: PrUserSummary[],
  currentUserLogin: string | undefined,
  selfLabel: string,
): string =>
  users
    .map(({ login }) => (login === currentUserLogin ? selfLabel : `@${login}`))
    .join(", ");

/**
 * Who a pull request belongs to, as both surfaces name them.
 *
 * `autoAssignToCreator` makes the author its own only assignee on most
 * repositories, which is a byline rather than an assignment worth stating, while
 * a pull request assigned away from its author needs both halves. A pull request
 * whose only person is the viewer says nothing by naming them, so it reports
 * nobody.
 */
export const selectPrOwners = (
  { assignees, creator }: Pick<PrSummary, "assignees" | "creator">,
  { currentUserLogin, selfLabel = "you" }: SelectPrOwnersOptions,
): PrOwners | undefined => {
  const named = [...(creator ? [creator] : []), ...assignees];
  if (named.length === 0) return undefined;
  if (
    currentUserLogin !== undefined &&
    named.every(({ login }) => login === currentUserLogin)
  ) {
    return undefined;
  }

  const byline = creator
    ? {
        users: [creator],
        label: `by ${formatLogins([creator], currentUserLogin, selfLabel)}`,
      }
    : undefined;

  if (assignees.length === 0) return byline;

  const assignment = {
    users: assignees,
    label: `assigned to ${formatLogins(assignees, currentUserLogin, selfLabel)}`,
  };

  // by login rather than by id: two users missing an id are not the same person
  if (!creator || !assignees.some(({ login }) => login === creator.login)) {
    return byline
      ? {
          users: [...byline.users, ...assignment.users],
          label: `${byline.label} · ${assignment.label}`,
        }
      : assignment;
  }

  // naming every assignee already names the author among them
  return assignees.length === 1 && byline ? byline : assignment;
};
