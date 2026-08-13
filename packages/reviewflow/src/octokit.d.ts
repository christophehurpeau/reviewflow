import type { Octokit as Core } from "@octokit/core";
import type { Octokit as RestOctokit } from "@octokit/rest";
import { ProbotOctokit } from "probot";
import type { Octokit as Core } from "@octokit/core";
import type { Constructor } from "@octokit/core/dist-types/types";
import type { PaginateInterface } from "@octokit/plugin-paginate-rest";
import type { RestEndpointMethods } from "@octokit/plugin-rest-endpoint-methods/dist-types/generated/method-types";

type ProbotOctokit = InstanceType<typeof ProbotOctokit>;

export declare type OctokitRestCompat = ProbotOctokit["rest"] | RestOctokit;
export declare type OctokitPaginate = ProbotOctokit["paginate"];

// export declare type CommonOctokitInterface = InstanceType<
//   typeof Core &
//     Constructor<
//       {
//         paginate: PaginateInterface;
//       } & RestEndpointMethods
//     >
// >;
