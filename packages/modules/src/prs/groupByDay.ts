export interface DayGroup<Item> {
  /** the day as the viewer reads it, or `Unknown date` */
  day: string;
  items: Item[];
}

export const unknownDay = "Unknown date";

const formatDay = (date: Date | undefined): string =>
  date === undefined
    ? unknownDay
    : date.toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });

/**
 * Groups items by the viewer's local day, as GitHub lists commits: days in the
 * order their first item appears, items in their given order within a day.
 */
export const groupByDay = <Item>(
  items: readonly Item[],
  dateOf: (item: Item) => Date | undefined,
): DayGroup<Item>[] => {
  const days = new Map<string, Item[]>();
  for (const item of items) {
    const day = formatDay(dateOf(item));
    const ofDay = days.get(day);
    if (ofDay === undefined) days.set(day, [item]);
    else ofDay.push(item);
  }
  return [...days].map(([day, ofDay]) => ({ day, items: ofDay }));
};
