import { shouldIgnoreRepo } from '../context/repoContext';
import ornikarConfig from './ornikar';

describe('ignoreRepoPattern', () => {
  it('should ignore some repositories', () => {
    expect(shouldIgnoreRepo('shared-config', ornikarConfig)).toBe(false);
    expect(shouldIgnoreRepo('infra-config', ornikarConfig)).toBe(true);
    expect(shouldIgnoreRepo('devenv', ornikarConfig)).toBe(true);
  });
});
