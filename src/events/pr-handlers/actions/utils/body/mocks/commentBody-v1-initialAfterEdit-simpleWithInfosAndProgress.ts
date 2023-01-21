export default `
### Infos:
Some informations here, like links.

### Progress

☑️ Step 1: ✏️ Write code
☑️ Step 2: 💚 Checks
⬜ Step 3: 👌 Code Review
⬜ Step 4: 🚦 Merging Pull Request

### Options:
- [ ] <!-- reviewflow-featureBranch -->This PR is a feature branch
- [ ] <!-- reviewflow-autoMergeWithSkipCi -->Add \`[skip ci]\` on merge commit
- [ ] <!-- reviewflow-autoMerge -->Auto merge when this PR is ready and has no failed statuses. (Also has a queue per repo to prevent multiple useless "Update branch" triggers)
### Actions:
- [ ] <!-- reviewflow-updateChecks -->:bug: Force updating reviewflow checks for this PR. Use this to try to fix reviewflow checks that are still missing/pending, which might happen if webhook failed or something bad happened when reviewflow tried to send the status check to github.
- [ ] <!-- reviewflow-updateBranch -->[:arrows_counterclockwise: update branch](https://github.com/christophehurpeau/reviewflow/labels/%3Aarrows_counterclockwise%3A%20update%20branch): Merge base branch in this PR's branch. Only works if merging is possible without conflicts.
`.trim();

// [ONK-0000](https://a;dlkas;dlkas;dk)
