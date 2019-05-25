export type Options =
  | 'featureBranch'
  | 'autoMergeWithSkipCi'
  | 'autoMerge'
  | 'deleteAfterMerge';

export const options: Options[] = [
  'featureBranch',
  'autoMergeWithSkipCi',
  'autoMerge',
  'deleteAfterMerge',
];
export const optionsRegexps: { name: Options; regexp: RegExp }[] = options.map(
  (option) => ({
    name: option,
    regexp: new RegExp(`\\[([ xX]?)]\\s*<!-- reviewflow-${option} -->`),
  }),
);

export const optionsLabels: { name: Options; label: string }[] = [
  { name: 'featureBranch', label: 'This PR is a feature branch' },
  {
    name: 'autoMergeWithSkipCi',
    label: 'Auto merge with `[skip ci]`',
  },
  {
    name: 'autoMerge',
    label:
      'Auto merge when this PR is ready and has no failed statuses. (Also has a queue per repo to prevent multiple useless "Update branch" triggers)',
  },
  {
    name: 'deleteAfterMerge',
    label: 'Automatic branch delete after this PR is merged',
  },
];
