import { githubPalette } from "./color-palettes/githubPalette.ts";
import type { Config } from "./types.ts";

const lateOceanColorPalette = {
  lateOcean: "#4C34E0",
  lateOceanLight1: "#705DE6",
  lateOceanLight2: "#9485EC",
  lateOceanLight3: "#D6BAF9",

  warmEmbrace: "#F4D3CE",
  warmEmbraceLight1: "#FFEDE6",

  black1000: "#000000",
  black800: "#333333",
  black555: "#737373",
  black400: "#999999",
  black200: "#CCCCCC",
  black100: "#E5E5E5",
  black50: "#F2F2F2",
  black25: "#F9F9F9",
  white: "#FFFFFF",

  viride: "#38836D",
  englishVermillon: "#D44148",
  goldCrayola: "#F8C583",
  aero: "#89BDDD",
  seaShell: "#FFF9F3",

  transparent: "transparent",

  moonPurple: "#DBD6F9",
  moonPurpleLight1: "#EDEBFC",
};

const config: Config<"backends" | "frontends" | "ops"> = {
  autoAssignToCreator: true,
  cleanTitle: "conventionalCommit",
  ignoreRepoPattern: "(infra-.*|devenv|bigquery-dbt|salesforce)",
  requiresReviewRequest: true,
  autoMergeRenovateWithSkipCi: false,
  onlyEnforceProgressWhenAutomergeEnabled: true,
  warnOnForcePushAfterReviewStarted: {
    repositoryNames: [
      "shared-configs",
      "shared-apps",
      "components",
      "kitt",
      "learner-apps",
      "sherwood-webapp",
      "vitrine",
    ],
    message:
      "Force-pushing after the review started is a bad practice. See https://ornikar.atlassian.net/wiki/spaces/TECH/pages/2972090451/Commits+and+Pull+Requests#Code-Review for more information.",
  },
  checksAllowedToFail: [
    "codecov/",
    "ci/circleci: test-e2e",
    "ci/circleci: tests-e2e",
    "SonarCloud Code Analysis",
    "SCOPED-STAGING",
  ],
  disableBypassMergeFor: /(shared-|orb|-configs)/,
  prDefaultOptions: {
    autoMergeWithSkipCi: false,
    autoMerge: false,
    deleteAfterMerge: true,
  },
  parsePR: {
    title: [
      {
        regExp:
          /^(?<revert>revert: )?(?<type>build|chore|ci|docs|feat|fix|perf|refactor|style|test)(?<scope>\([/A-Za-z-]+\)?(?:(?=:\s)|(?=!:\s)))?(?<breaking>!)?(?<subject>:\s.*)$/,
        createStatusInfo: (match) => {
          if (match) {
            return null;
          }

          return {
            type: "failure",
            title: "Title does not match commitlint conventional",
            summary:
              "https://www.npmjs.com/package/@commitlint/config-conventional",
          };
        },
      },
      {
        regExp: /\s([A-Z][\dA-Z]+-(\d+)|\[no issue\])$/,
        status: "jira-issue",
        createStatusInfo: (match, prInfo, isPrFromBot) => {
          if (match) {
            const issue = match[1];
            if (issue === "[no issue]") {
              return {
                type: "success",
                title: "✓ No issue",
                summary: "",
              };
            }
            // The 'OD' JIRA Project is hosted on guidewire's JIRA
            const url = issue?.startsWith("OD-")
              ? `https://gwjira.atlassian.net/browse/${issue}`
              : `https://ornikar.atlassian.net/browse/${issue}`;
            return {
              type: "success",
              inBody: true,
              title: `✓ JIRA issue: ${issue}`,
              summary: `[${issue}](${url})`,
              url,
            };
          }

          if (isPrFromBot) {
            return {
              type: "success",
              title: "Title does not have Jira issue but PR created by bot",
              summary: "",
            };
          }

          return {
            type: "failure",
            title: "Title does not have Jira issue",
            summary: "The PR title should end with ONK-0000, or [no issue]",
          };
        },
      },
    ],
    body: [
      {
        bot: false,
        regExp: /^(.*)$/s,
        createStatusInfo: (match) => {
          const description = match?.[1];
          if (!description?.trim()) {
            return {
              type: "failure",
              title: "Body is empty",
              summary: "The PR body should not be empty",
            };
          }
          const descriptionStripTitlesAndComments = description
            .replace(/^\s*#+\s+.*/gm, "")
            .replace(/<!--.*?-->|<!--[\s\S]*$/gs, "");

          if (!descriptionStripTitlesAndComments.trim()) {
            return {
              type: "failure",
              title: "Body has no meaningful content",
              summary:
                "The PR body should not contains only titles and comments",
            };
          }
          return null;
        },
      },
    ],
    head: [
      {
        bot: false,
        regExp:
          // eslint-disable-next-line regexp/optimal-quantifier-concatenation
          /^(?<revert>revert-\d+-)?(?<type>build|chore|ci|docs|feat|fix|perf|refactor|style|test)(?<scope>\/[a-z-]+)?\/(?<breaking>!)?(?<subject>.*)(?:-(?<jiraIssue>[A-Z][\dA-Z]+-(\d+)))?$/,
        status: "branch-name",
        createStatusInfo: (match, { title }) => {
          const idealBranchName = title
            .replace(/\s*\[no issue\]$/, "")
            .replace(/\s*(?:\(|\):|:)\s*/g, "/")
            .replace(/[\s,_-]+/g, "-");

          if (!match) {
            return {
              type: "success",
              title: `⚠️ Suggested branch name: "${idealBranchName}"`,
              summary: "",
            };
          }

          if (match[0] === idealBranchName) {
            return {
              type: "success",
              title: "✓ The branch name matches PR title",
              summary: "",
            };
          }

          return {
            type: "success",
            title: "✓ The branch name is valid",
            summary: "",
          };
        },
      },
    ],
    base: [
      {
        regExp: /^(master|main|develop)(-|$)/,
        createStatusInfo: (match) => {
          if (match) {
            return null;
          }

          return {
            type: "failure",
            title: "PR to branches other than main is not recommended",
            summary: "",
            url: "https://ornikar.atlassian.net/wiki/spaces/TECH/pages/2221900272/Should+I+make+a+feature-branch+or+not",
          };
        },
      },
    ],
  },

  botUsers: ["michael-robot"],

  teams: {
    ops: {
      githubTeamName: "ops",
    },

    backends: {
      githubTeamName: "backend",
    },

    frontends: {
      githubTeamName: "frontend",
    },
  },

  labels: {
    legacyToRemove: {
      /* checks */
      "checks/in-progress": {
        name: ":green_heart: checks/in-progress",
        color: githubPalette.scaleGray6,
      },
      "checks/failed": {
        name: ":green_heart: checks/fail",
        color: githubPalette.dangerEmphasis,
      },
      "checks/passed": {
        name: ":green_heart: checks/passed",
        color: githubPalette.successEmphasis,
      },

      /* code */
      "code/needs-review": {
        name: ":ok_hand: code/needs-review",
        color: githubPalette.attentionEmphasis,
      },
      "code/review-requested": {
        name: ":ok_hand: code/review-requested",
        color: githubPalette.scaleGray6,
      },
      "code/changes-requested": {
        name: ":ok_hand: code/changes-requested",
        color: githubPalette.dangerEmphasis,
      },
      "code/approved": {
        name: ":ok_hand: code/approved",
        color: githubPalette.successEmphasis,
      },

      /* design */
      "design/needs-review": {
        name: ":art: design/needs-review",
        color: githubPalette.attentionEmphasis,
      },
      "design/review-requested": {
        name: ":art: design/review-requested",
        color: githubPalette.scaleGray6,
      },
      "design/changes-requested": {
        name: ":art: design/changes-requested",
        color: githubPalette.dangerEmphasis,
      },
      "design/approved": {
        name: ":art: design/approved",
        color: githubPalette.successEmphasis,
      },

      /* teams */
      "teams/ops": {
        name: "ops",
        color: lateOceanColorPalette.warmEmbrace,
      },
      "teams/backend": {
        name: "backend",
        color: lateOceanColorPalette.aero,
      },
      "teams/frontend": {
        name: "frontend",
        color: lateOceanColorPalette.lateOcean,
      },
    },
    list: {
      /* auto approve */
      "review/auto-approve": {
        name: ":white_check_mark: bot approval",
        description:
          "Adding this label will trigger reviewflow approval for PRs opened by bots",
        color: githubPalette.successEmphasis,
      },

      /* auto merge */
      "merge/automerge": {
        name: ":soon: automerge",
        color: githubPalette.successEmphasis,
      },
      "merge/skip-ci": {
        name: ":vertical_traffic_light: skip-ci",
        color: githubPalette.scaleBlue1,
      },
      "merge/update-branch": {
        name: ":arrows_counterclockwise: update branch",
        color: githubPalette.accentEmphasis,
      },
      "merge/bypass-progress": {
        name: ":soon: bypass progress",
        color: githubPalette.dangerEmphasis,
      },

      /* feature-branch */
      "feature-branch": {
        name: "feature-branch",
        color: githubPalette.accentEmphasis,
      },

      /* infos */
      "breaking-changes": {
        name: ":warning: Breaking Changes",
        description: "This issue or pull request will need a new major version",
        color: githubPalette.attentionEmphasis,
      },
      duplicate: {
        name: "duplicate",
        description: "This issue or pull request already exists",
        color: lateOceanColorPalette.moonPurple,
      },
      documentation: {
        name: "documentation",
        description: "Improvements or additions to documentation",
        color: lateOceanColorPalette.lateOceanLight3,
      },
      rfc: {
        name: "RFC",
        description: "Request For Comments",
        color: lateOceanColorPalette.lateOceanLight1,
      },
      bug: {
        name: "bug",
        description: "Something isn't working",
        color: lateOceanColorPalette.englishVermillon,
      },
      enhancement: {
        name: "enhancement",
        description: "New feature or request",
        color: lateOceanColorPalette.aero,
      },
      "help-wanted": {
        name: "help wanted",
        description: "Extra attention is needed",
        color: lateOceanColorPalette.goldCrayola,
      },
      question: {
        name: "question",
        description: "Further information is requested",
        color: lateOceanColorPalette.lateOceanLight2,
      },
      wontfix: {
        name: "wontfix",
        description: "This will not be worked on",
        color: lateOceanColorPalette.moonPurple,
      },
    },
  },
};

export default config;
