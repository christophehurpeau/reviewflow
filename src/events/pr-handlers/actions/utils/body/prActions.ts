export type ActionKeys = "updateBranch" | "updateChecks";

export const actions: ActionKeys[] = ["updateChecks", "updateBranch"];
export const actionRegexps: {
  key: ActionKeys;
  regexp: RegExp;
}[] = actions.map((action) => ({
  key: action,
  regexp: new RegExp(`\\[([ xX]?)]\\s*<!-- reviewflow-${action} -->`),
}));

interface ActionDisplay {
  key: ActionKeys;
  labelKey?: string;
  icon?: string;
  description: string;
}

export const actionDescriptions: ActionDisplay[] = [
  {
    key: "updateChecks",
    icon: ":bug:",
    description:
      "Force updating reviewflow checks for this PR. Use this to try to fix reviewflow checks that are still missing/pending, which might happen if webhook failed or something bad happened when reviewflow tried to send the status check to github.",
  },
  {
    key: "updateBranch",
    labelKey: "merge/update-branch",
    description:
      "Merge base branch in this PR's branch. Only works if merging is possible without conflicts.",
  },
];
