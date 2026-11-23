/**
 * How a diff lists its files. `packages`: by package, in patch order.
 * `reading` (experimental): packages from the one depending on the others
 * down, files from their entry points down, tests and stories closed below the
 * file they cover. Plain data, so a server can validate a stored setting
 * against the same list the ui offers.
 */
export const diffFileOrders = ["packages", "reading"] as const;

export type DiffFileOrder = (typeof diffFileOrders)[number];

export const defaultDiffFileOrder: DiffFileOrder = "packages";

export const isDiffFileOrder = (value: unknown): value is DiffFileOrder =>
  (diffFileOrders as readonly unknown[]).includes(value);
