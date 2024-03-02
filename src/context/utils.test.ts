import { equal } from 'node:assert/strict';
import { describe, it } from 'node:test';
import { getEmojiFromRepoDescription } from './utils';

describe('getEmojiFromRepoDescription', () => {
  it('should return emoji when emoji is with the form :emoji_name:', () => {
    equal(
      getEmojiFromRepoDescription(':star: Ornikar shared configs'),
      ':star:',
    );
  });
  it('should return emoji when emoji is with a unicode char', () => {
    equal(getEmojiFromRepoDescription('👨‍🎓 Ornikar shared configs'), '👨‍🎓');
  });
  it('should not return any emoji when there is no emoji', () => {
    equal(getEmojiFromRepoDescription('Ornikar shared configs'), '');
  });
  it('should not return any emoji when emoji is at the end of the description', () => {
    equal(getEmojiFromRepoDescription('Ornikar shared configs :star:'), '');
    equal(getEmojiFromRepoDescription('Ornikar shared configs 👨‍🎓'), '');
  });
});
