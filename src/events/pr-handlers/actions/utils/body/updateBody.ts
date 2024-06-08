import type {
  LabelList,
  StatusInfo,
} from "../../../../../accountConfigs/types";
import type { StepState } from "../steps/BaseStepState";
import { steps } from "../steps/calcStepsState";
import type { StepsState } from "../steps/calcStepsState";
import type { Options } from "./parseBody";
import { parseActions, parseOptions } from "./parseBody";
import type { ActionKeys } from "./prActions";
import { actionDescriptions } from "./prActions";
import { optionsDescriptions } from "./prOptions";
import type { RepositorySettings } from "./repositorySettings";

export const defaultCommentBody = "This will be auto filled by reviewflow.";

const toMarkdownOptions = (
  repositorySettings: RepositorySettings,
  repoLink: string,
  labelsConfig: LabelList,
  options: Options,
  defaultOptions: Options,
): string => {
  return optionsDescriptions
    .map(({ key, labelKey, description, icon: iconValue, legacy }) => {
      if (
        legacy &&
        (repositorySettings[legacy.repositorySettingKey] ||
          !defaultOptions[key])
      ) {
        return null;
      }
      const labelDescription = labelKey && labelsConfig[labelKey];

      if (labelKey && !labelDescription) {
        // this option is not enabled
        return null;
      }

      const checkboxWithId = `[${
        options[key] ? "x" : " "
      }] <!-- reviewflow-${key} -->`;

      const labelLink = labelDescription
        ? `[${labelDescription.name}](${repoLink}/labels/${encodeURIComponent(
            labelDescription.name,
          )}): `
        : "";
      const icon = labelLink || !iconValue ? "" : `${iconValue} `;

      return `- ${checkboxWithId}${icon}${labelLink}${description}${
        legacy ? ` (:warning: Legacy Option: ${legacy.legacyMessage})` : ""
      }`;
    })
    .filter(Boolean)
    .join("\n");
};

const toMarkdownActions = (
  repoLink: string,
  labelsConfig: LabelList,
): string => {
  return actionDescriptions
    .map(({ key, labelKey, description, icon: iconValue }) => {
      // should always update without ticking the box
      const checkboxWithId = `[ ] <!-- reviewflow-${key} -->`;

      const labelDescription = labelKey && labelsConfig[labelKey];

      if (labelKey && !labelDescription) {
        // this action is not enabled
        return null;
      }

      const labelLink = labelDescription
        ? `[${labelDescription.name}](${repoLink}/labels/${encodeURIComponent(
            labelDescription.name,
          )}): `
        : "";
      const icon = labelLink || !iconValue ? "" : `${iconValue} `;

      return `- ${checkboxWithId}${icon}${labelLink}${description}`;
    })
    .filter(Boolean)
    .join("\n");
};

const toMarkdownInfos = (infos: StatusInfo[]): string => {
  return infos
    .map((info) => {
      if (info.details) {
        return info.details;
      }
      if (info.url) return `[${info.title}](${info.url})`;
      return info.title;
    })
    .join("\n\n");
};

interface UpdatedBodyWithOptions {
  commentBody: string;
  options?: Options;
  actions: ActionKeys[];
}

const getEmojiFromStepsState = (stepState: StepState): string => {
  switch (stepState) {
    case "not-started":
      return "⬜";
    case "in-progress":
      return "🟡";
    case "failed":
      return "🔴";
    case "passed":
      return "☑️";
    default:
      // fallback
      return "";
  }
};

const getProgressReplacement = (stepsState: StepsState): string => {
  return `### Progress\n\n${steps
    .map(
      ({ name, key }) =>
        `${getEmojiFromStepsState(stepsState[key].state)} ${name}`,
    )
    .join("\n")}\n\n`;
};

const getInfosReplacement = (
  infoReplacement: string,
  infos?: StatusInfo[],
): string => {
  if (!infos) return infoReplacement;
  return infos.length > 0 ? `### Infos:\n\n${toMarkdownInfos(infos)}\n\n` : "";
};

const updateOptions = (
  options: Options,
  optionsToUpdate?: Partial<Options>,
): Options => {
  if (!optionsToUpdate) return options;
  return { ...options, ...optionsToUpdate };
};

const internalUpdateBodyOptionsAndInfos = (
  repositorySettings: RepositorySettings,
  repoLink: string,
  labelsConfig: LabelList,
  body: string,
  options: Options,
  defaultOptions: Options,
  infos?: StatusInfo[],
): string => {
  const infosAndCommitNotesParagraph = body.replace(
    /^\s*(?:(####? Progress:?.*)?(####? Infos:?.*)?(####? Commits Notes:?.*)?####? Options:?)?.*$/s,
    `$1${getInfosReplacement("$2", infos)}$3`,
  );

  return `${infosAndCommitNotesParagraph}### Options:\n${toMarkdownOptions(
    repositorySettings,
    repoLink,
    labelsConfig,
    options,
    defaultOptions,
  )}\n### Actions:\n${toMarkdownActions(repoLink, labelsConfig)}`;
};

export const createCommentBody = (
  repositorySettings: RepositorySettings,
  repoLink: string,
  labelsConfig: LabelList,
  defaultOptions: Options,
  stepsState?: StepsState,
  infos?: StatusInfo[],
): string => {
  return internalUpdateBodyOptionsAndInfos(
    repositorySettings,
    repoLink,
    labelsConfig,
    stepsState ? getProgressReplacement(stepsState) : "",
    defaultOptions,
    defaultOptions,
    infos,
  );
};

export const updateCommentOptions = (
  repositorySettings: RepositorySettings,
  repoLink: string,
  labelsConfig: LabelList,
  commentBody: string,
  defaultOptions: Options,
  optionsToUpdate?: Partial<Options>,
): UpdatedBodyWithOptions => {
  const options = parseOptions(commentBody, defaultOptions);
  const updatedOptions = updateOptions(options, optionsToUpdate);

  return {
    options: updatedOptions,
    actions: parseActions(commentBody),
    commentBody: internalUpdateBodyOptionsAndInfos(
      repositorySettings,
      repoLink,
      labelsConfig,
      commentBody,
      updatedOptions,
      defaultOptions,
    ),
  };
};

export const updateCommentBodyInfos = (
  commentBody: string,
  infos?: StatusInfo[],
): string => {
  return commentBody.replace(
    // *  - zero or more
    // *? - zero or more (non-greedy)

    /^\s*(####? Progress:?.*?)?(?:(####? Infos:?.*?)?(####? Commits Notes:?.*?)?(####? Options:?.*?)?)?$/s,
    `$1${getInfosReplacement("$2", infos)}$3$4`,
  );
};

export const updateCommentBodyProgress = (
  commentBody: string,
  stepsState: StepsState,
): string => {
  return commentBody.replace(
    // *  - zero or more
    // *? - zero or more (non-greedy)

    /^\s*(####? Progress:?.*?)?(?:(####? Infos:?.*?)?(####? Commits Notes:?.*?)?(####? Options:?.*?)?)?$/s,
    `${getProgressReplacement(stepsState)}$2$3$4`,
  );
};

export const updateCommentBodyCommitsNotes = (
  commentBody: string,
  commitNotes?: string,
): string => {
  return commentBody.replace(
    /(?:####? Commits Notes:.*?)?(####? Options:)/s,
    !commitNotes ? "$1" : `### Commits Notes:\n\n${commitNotes}\n\n$1`,
  );
};

export const removeDeprecatedReviewflowInPrBody = (
  prBody: string | null,
): string => {
  if (!prBody) return "";
  return prBody.replace(
    /^(.*)<!---? do not edit after this -?-->(.*)<!---? end - don't add anything after this -?-->(.*)$/is,
    "$1$3",
  );
};
