import { getEmojiFromRepoDescription } from './utils';

describe('getEmojiFromRepoDescription', () => {
  it('should return emoji when emoji is with the form :emoji_name:', () => {
    expect(getEmojiFromRepoDescription(':star: Ornikar shared configs')).toBe(
      ':star:',
    );
  });
  it('should return emoji when emoji is with a unicode char', () => {
    expect(getEmojiFromRepoDescription('👨‍🎓 Ornikar shared configs')).toBe('👨‍🎓');
  });
  it('should not return any emoji when there is no emoji', () => {
    expect(getEmojiFromRepoDescription('Ornikar shared configs')).toBe('');
  });
  it('should not return any emoji when emoji is at the end of the description', () => {
    expect(getEmojiFromRepoDescription('Ornikar shared configs :star:')).toBe(
      '',
    );
    expect(getEmojiFromRepoDescription('Ornikar shared configs 👨‍🎓')).toBe('');
  });
});
