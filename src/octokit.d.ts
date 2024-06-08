import type { Octokit as Core } from "@octokit/core";
import { ProbotOctokit } from "probot";
import type { Octokit as Core } from "@octokit/core";
import type { Constructor } from "@octokit/core/dist-types/types";
import type { PaginateInterface } from "@octokit/plugin-paginate-rest";
import type { RestEndpointMethods } from "@octokit/plugin-rest-endpoint-methods/dist-types/generated/method-types";

export declare type Octokit = InstanceType<typeof ProbotOctokit>;

export declare type CommonOctokitInterface = InstanceType<
  typeof Core &
    Constructor<
      {
        paginate: PaginateInterface;
      } & RestEndpointMethods
    >
>;
