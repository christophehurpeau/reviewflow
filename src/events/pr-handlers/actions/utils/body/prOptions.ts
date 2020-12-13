export type OptionsKeys =
  | 'featureBranch'
  | 'autoMergeWithSkipCi'
  | 'autoMerge'
  | 'deleteAfterMerge';

export type Options = Record<OptionsKeys, boolean>;

export const options: OptionsKeys[] = [
  'featureBranch',
  'autoMergeWithSkipCi',
  'autoMerge',
  'deleteAfterMerge',
];
export const optionsRegexps: {
  key: OptionsKeys;
  regexp: RegExp;
}[] = options.map((option) => ({
  key: option,
  regexp: new RegExp(`\\[([ xX]?)]\\s*<!-- reviewflow-${option} -->`),
}));

export const optionsLabels: { key: OptionsKeys; label: string }[] = [
  { key: 'featureBranch', label: 'This PR is a feature branch' },
  {
    key: 'autoMergeWithSkipCi',
    label: 'Add `[skip ci]` on merge commit',
  },
  {
    key: 'autoMerge',
    label:
      'Auto merge when this PR is ready and has no failed statuses. (Also has a queue per repo to prevent multiple useless "Update branch" triggers)',
  },
  {
    key: 'deleteAfterMerge',
    label: 'Automatic branch delete after this PR is merged',
  },
];
