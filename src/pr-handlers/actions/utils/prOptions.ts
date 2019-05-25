export type Options = 'featureBranch' | 'autoMerge' | 'deleteAfterMerge';

export const options: Options[] = [
  'featureBranch',
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
    name: 'autoMerge',
    label:
      'Auto merge when this PR is ready and has no failed statuses. (Also has a queue per repo to prevent multiple useless "Update branch" triggers)',
  },
  {
    name: 'deleteAfterMerge',
    label: 'Automatic branch delete after this PR is merged',
  },
];
