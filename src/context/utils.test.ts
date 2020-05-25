import { getEmojiFromRepoDescription } from './utils';

describe('getEmojiFromRepoDescription', () => {
  it('should return emoji', () => {
    expect(getEmojiFromRepoDescription(':star: Ornikar shared configs')).toBe(
      ':star:',
    );
  });
  it('should not return any emoji', () => {
    expect(getEmojiFromRepoDescription('Ornikar shared configs :star:')).toBe(
      '',
    );
  });
  it('should not return any emoji', () => {
    expect(getEmojiFromRepoDescription('Ornikar shared configs')).toBe('');
  });
});
