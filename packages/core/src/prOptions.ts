export type OptionsKeys =
  | "autoMerge"
  | "autoMergeWithSkipCi"
  | "deleteAfterMerge";

export type Options = Record<OptionsKeys, boolean>;

export const options: OptionsKeys[] = [
  "autoMerge",
  "autoMergeWithSkipCi",
  "deleteAfterMerge",
];
