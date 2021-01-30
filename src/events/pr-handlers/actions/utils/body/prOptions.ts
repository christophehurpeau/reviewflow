export type OptionsKeys =
  | 'autoMerge'
  | 'autoMergeWithSkipCi'
  | 'deleteAfterMerge';

export type Options = Record<OptionsKeys, boolean>;

export const options: OptionsKeys[] = [
  'autoMerge',
  'autoMergeWithSkipCi',
  'deleteAfterMerge',
];
export const optionsRegexps: {
  key: OptionsKeys;
  regexp: RegExp;
}[] = options.map((option) => ({
  key: option,
  regexp: new RegExp(`\\[([ xX]?)]\\s*<!-- reviewflow-${option} -->`),
}));

interface OptionDisplay {
  key: OptionsKeys;
  labelKey?: string;
  icon?: string;
  description: string;
}

export const optionsDescriptions: OptionDisplay[] = [
  {
    key: 'autoMerge',
    labelKey: 'merge/automerge',
    description:
      'Automatically merge when this PR is ready and has no failed statuses. When the repository requires _branches to be up to date before merging_, it merges default branch, with a queue per repo to prevent multiple merges when several PRs are ready. A fail job prevents the merge.',
  },
  {
    key: 'autoMergeWithSkipCi',
    labelKey: 'merge/skip-ci',
    description:
      'Add `[skip ci]` on merge commit when merge is done with autoMerge.',
  },
  {
    key: 'deleteAfterMerge',
    icon: ':recycle:',
    description: 'Automatically delete the branch after this PR is merged.',
  },
];
