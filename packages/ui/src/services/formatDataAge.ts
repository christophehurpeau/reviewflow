import type { IsoDateTime } from "@reviewflow/sdk";

/**
 * Static on purpose: the line is read when the board is looked at, and a ticking
 * re-render would cost a timer per button to say the same thing a minute later.
 */
export const formatDataAge = (date: IsoDateTime): string => {
  const then = new Date(date);
  return then.toDateString() === new Date().toDateString()
    ? then.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : then.toLocaleString();
};
