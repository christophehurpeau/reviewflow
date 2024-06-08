import type { LabelResponse } from "../../../context/initRepoLabels";
import type {
  CustomExtract,
  EventsWithRepository,
} from "../../../context/repoContext";
import type { ProbotEvent } from "../../probot-types";
import type { EventsWithPullRequest } from "./createPullRequestHandler";
import type { PullRequestFromRestEndpoint } from "./fetchPr";

export type PullRequestWithDecentDataFromWebhook =
  ProbotEvent<EventsWithPullRequest>["payload"]["pull_request"];

export type PullRequestFromWebhook =
  | ProbotEvent<
      CustomExtract<EventsWithRepository, "check_run.completed">
    >["payload"]["check_run"]["pull_requests"][number]
  | PullRequestWithDecentDataFromWebhook;

export type { PullRequestFromRestEndpoint } from "./fetchPr";

export type PullRequestData =
  | PullRequestFromRestEndpoint
  | PullRequestFromWebhook;

export interface PullRequestDataMinimumData {
  id: PullRequestData["id"];
  number: PullRequestData["number"];
}

export type PullRequestWithDecentData =
  | PullRequestFromRestEndpoint
  | PullRequestWithDecentDataFromWebhook;

export type PullRequestLabels =
  | LabelResponse[]
  | PullRequestWithDecentData["labels"];

export interface BasicUser {
  id: number;
  login: string;
  type: string | "Bot" | "User";
  avatar_url: string;
}
export function toBasicUser<U extends BasicUser>(user: U): BasicUser {
  return {
    id: user.id,
    login: user.login,
    type: user.type,
    avatar_url: user.avatar_url,
  };
}
