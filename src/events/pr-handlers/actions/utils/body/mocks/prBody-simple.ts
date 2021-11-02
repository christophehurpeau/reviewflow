export default `
### Context
Explain here why this PR is needed

### Solution
If needed, explain here the solution you chose for this

<!-- Uncomment this if you need a testing plan
### Testing plan
- [ ] Test this
- [ ] Test that
-->

<!-- do not edit after this -->
### Options:
- [ ] <!-- reviewflow-featureBranch -->This PR is a feature branch
- [ ] <!-- reviewflow-autoMergeWithSkipCi -->Add \`[skip ci]\` on merge commit
- [ ] <!-- reviewflow-autoMerge -->Auto merge when this PR is ready and has no failed statuses. (Also has a queue per repo to prevent multiple useless "Update branch" triggers)
- [x] <!-- reviewflow-deleteAfterMerge -->Automatic branch delete after this PR is merged
<!-- end - don't add anything after this -->

Some ending lines.
This is the case with renovate for example.
`.trim();

// [ONK-0000](https://a;dlkas;dlkas;dk)
