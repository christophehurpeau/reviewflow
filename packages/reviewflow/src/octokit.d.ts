import { ProbotOctokit } from "probot";
import type { Octokit as Core } from "@octokit/core";
import type { Constructor } from "@octokit/core/dist-types/types";
import type { PaginateInterface } from "@octokit/plugin-paginate-rest";
import type { RestEndpointMethods } from "@octokit/plugin-rest-endpoint-methods/dist-types/generated/method-types";

type ProbotOctokit = InstanceType<typeof ProbotOctokit>;

export declare type OctokitRestCompat = ProbotOctokit["rest"];
export declare type OctokitPaginate = ProbotOctokit["paginate"];

/**
 * `RestEndpointMethodTypes` of the rest plugin probot bundles, which can be a
 * major ahead of the one `@octokit/rest` depends on.
 */
export declare type RestEndpointMethodTypes = {
  [Scope in keyof OctokitRestCompat]: {
    [
      Method in keyof OctokitRestCompat[Scope]
    ]: OctokitRestCompat[Scope][Method] extends (
      params?: infer Parameters,
    ) => Promise<infer Response>
      ? { parameters: Parameters; response: Response }
      : never;
  };
};

// export declare type CommonOctokitInterface = InstanceType<
//   typeof Core &
//     Constructor<
//       {
//         paginate: PaginateInterface;
//       } & RestEndpointMethods
//     >
// >;
