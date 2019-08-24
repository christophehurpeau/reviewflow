import { randomBytes } from 'crypto';
import { promisify } from 'util';

const randomBytesPromisified = promisify(randomBytes);

export async function randomBase64(size: number): Promise<string> {
  const buffer = await randomBytesPromisified(size);
  return buffer.toString('base64');
}

export async function randomHex(size: number): Promise<string> {
  const buffer = await randomBytesPromisified(size);
  return buffer.toString('hex');
}
