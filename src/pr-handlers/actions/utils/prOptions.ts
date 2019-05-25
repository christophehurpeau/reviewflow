export type Options = 'featureBranch' | 'deleteAfterMerge';

export const options: Options[] = ['featureBranch', 'deleteAfterMerge'];
export const optionsRegexps: { name: Options; regexp: RegExp }[] = options.map(
  (option) => ({
    name: option,
    regexp: new RegExp(`\\[([ xX]?)]\\s*<!-- reviewflow-${option} -->`),
  }),
);

export const optionsLabels: { name: Options; label: string }[] = [
  { name: 'featureBranch', label: 'This PR is a feature branch' },
  {
    name: 'deleteAfterMerge',
    label: 'Automatic branch delete after this PR is merged',
  },
];
