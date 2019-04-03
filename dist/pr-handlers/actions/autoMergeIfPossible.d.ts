import { Context } from 'probot';
import { RepoContext } from '../../context/repoContext';
import { LabelResponse } from '../../context/initRepoLabels';
export declare const autoMergeIfPossible: (context: Context<any>, repoContext: RepoContext<any>, pr?: any, prLabels?: LabelResponse[]) => Promise<boolean>;
//# sourceMappingURL=autoMergeIfPossible.d.ts.map