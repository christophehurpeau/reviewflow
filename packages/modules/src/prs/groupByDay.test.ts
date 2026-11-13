import { describe, expect, it } from "vitest";
import { groupByDay, unknownDay } from "./groupByDay.ts";

interface Dated {
  id: string;
  at?: Date;
}

const dayOf = (date: Date): string =>
  date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

describe("groupByDay", () => {
  it("groups items of the same day, keeping the given order", () => {
    const items: Dated[] = [
      { id: "a", at: new Date("2026-11-12T12:00:00Z") },
      { id: "b", at: new Date("2026-11-12T11:00:00Z") },
      { id: "c", at: new Date("2026-11-10T12:00:00Z") },
    ];

    expect(groupByDay(items, (item) => item.at)).toEqual([
      {
        day: dayOf(new Date("2026-11-12T12:00:00Z")),
        items: [items[0], items[1]],
      },
      { day: dayOf(new Date("2026-11-10T12:00:00Z")), items: [items[2]] },
    ]);
  });

  it("puts items without a date under an unknown day", () => {
    const items: Dated[] = [
      { id: "a", at: new Date("2026-11-12T12:00:00Z") },
      { id: "b" },
    ];

    expect(groupByDay(items, (item) => item.at)).toEqual([
      { day: dayOf(new Date("2026-11-12T12:00:00Z")), items: [items[0]] },
      { day: unknownDay, items: [items[1]] },
    ]);
  });
});
