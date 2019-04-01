import Webhooks from '@octokit/webhooks';
import { Context } from 'probot';
import { RepoContext } from '../context/repoContext';
export declare type CallbackWithRepoContext = (repoContext: RepoContext) => void | Promise<void>;
export declare const handlerPullRequestChange: <T extends Webhooks.WebhookPayloadPullRequest>(context: Context<T>, callback: CallbackWithRepoContext) => Promise<void>;
export declare const createHandlerPullRequestChange: <T extends Webhooks.WebhookPayloadPullRequest>(callback: (context: Context<T>, repoContext: RepoContext<any>) => void | Promise<void>) => (context: Context<T>) => Promise<void>;
export declare type Handler<T = any> = (context: Context<T>, repoContext: RepoContext, ...args: any[]) => Promise<void>;
//# sourceMappingURL=utils.d.ts.map