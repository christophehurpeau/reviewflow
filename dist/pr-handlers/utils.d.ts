import Webhooks from '@octokit/webhooks';
import { Context } from 'probot';
import { RepoContext } from '../context/repoContext';
export declare type Handler<T = any> = (context: Context<T>, repoContext: RepoContext) => Promise<void>;
export declare type CallbackWithRepoContext = (repoContext: RepoContext) => void | Promise<void>;
export declare const handlerPullRequestChange: <T extends Webhooks.WebhookPayloadPullRequest>(context: Context<T>, callback: CallbackWithRepoContext) => Promise<void>;
declare type CallbackContextAndRepoContext<T> = (context: Context<T>, repoContext: RepoContext) => void | Promise<void>;
export declare const createHandlerPullRequestChange: <T extends Webhooks.WebhookPayloadPullRequest>(callback: CallbackContextAndRepoContext<T>) => (context: Context<T>) => Promise<void>;
export declare const createHandlerPullRequestsChange: <T>(getPullRequests: (context: Context<T>, repoContext: RepoContext<any>) => any[], callback: CallbackContextAndRepoContext<T>) => (context: Context<T>) => Promise<void>;
export {};
//# sourceMappingURL=utils.d.ts.map