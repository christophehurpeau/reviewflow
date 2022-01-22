export default `
### Options:
- [ ] <!-- reviewflow-autoMerge -->[:vertical_traffic_light: automerge](https://github.com/christophehurpeau/reviewflow/labels/%3Avertical_traffic_light%3A%20automerge): Automatically merge when this PR is ready and has no failed statuses. When the repository requires _branches to be up to date before merging_, it merges default branch, with a queue per repo to prevent multiple merges when several PRs are ready. A fail job prevents the merge.
- [ ] <!-- reviewflow-autoMergeWithSkipCi -->[:vertical_traffic_light: skip-ci](https://github.com/christophehurpeau/reviewflow/labels/%3Avertical_traffic_light%3A%20skip-ci): Add \`[skip ci]\` on merge commit when merge is done with autoMerge.
- [x] <!-- reviewflow-deleteAfterMerge -->:recycle: Automatically delete the branch after this PR is merged.
### Actions:
- [ ] <!-- reviewflow-updateChecks -->:bug: Force updating reviewflow checks for this PR. Use this to try to fix reviewflow checks that are still missing/pending, which might happen if webhook failed or something bad happened when reviewflow tried to send the status check to github.
- [ ] <!-- reviewflow-updateBranch -->[:arrows_counterclockwise: update branch](https://github.com/christophehurpeau/reviewflow/labels/%3Aarrows_counterclockwise%3A%20update%20branch): Merge base branch in this PR's branch. Only works if merging is possible without conflicts.
`.trim();

// [ONK-0000](https://a;dlkas;dlkas;dk)
