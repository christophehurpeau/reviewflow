export default `
### Options:
- [ ] <!-- reviewflow-featureBranch -->This PR is a feature branch
- [ ] <!-- reviewflow-autoMergeWithSkipCi -->Add \`[skip ci]\` on merge commit
- [ ] <!-- reviewflow-autoMerge -->Auto merge when this PR is ready and has no failed statuses. (Also has a queue per repo to prevent multiple useless "Update branch" triggers)
- [x] <!-- reviewflow-deleteAfterMerge -->Automatic branch delete after this PR is merged
`.trim();

// [ONK-0000](https://a;dlkas;dlkas;dk)
