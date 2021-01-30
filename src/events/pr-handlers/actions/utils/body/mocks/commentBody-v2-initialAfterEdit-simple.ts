export default `
#### Options:
- [ ] <!-- reviewflow-autoMerge -->[:vertical_traffic_light: automerge](https://github.com/christophehurpeau/reviewflow/labels/%3Avertical_traffic_light%3A%20automerge): Automatically merge when this PR is ready and has no failed statuses. When the repository requires _branches to be up to date before merging_, it merges default branch, with a queue per repo to prevent multiple merges when several PRs are ready. A fail job prevents the merge.
- [ ] <!-- reviewflow-autoMergeWithSkipCi -->[:vertical_traffic_light: skip-ci](https://github.com/christophehurpeau/reviewflow/labels/%3Avertical_traffic_light%3A%20skip-ci): Add \`[skip ci]\` on merge commit when merge is done with autoMerge.
- [x] <!-- reviewflow-deleteAfterMerge -->:recycle: Automatically delete the branch after this PR is merged.
`.trim();

// [ONK-0000](https://a;dlkas;dlkas;dk)
