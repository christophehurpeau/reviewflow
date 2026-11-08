import type { IncomingMessage } from "node:http";

export const bodyTooLargeCode = "ERR_BODY_TOO_LARGE";

/** Bounded read: a runaway payload is refused rather than held in memory. */
export const readBody = async (
  request: IncomingMessage,
  maxBytes = 1024 * 1024,
): Promise<string> => {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    const buffer = chunk as Buffer;
    size += buffer.length;
    if (size > maxBytes) {
      request.destroy();
      throw Object.assign(new Error(`body exceeds ${String(maxBytes)} bytes`), {
        code: bodyTooLargeCode,
      });
    }
    chunks.push(buffer);
  }
  return Buffer.concat(chunks).toString("utf8");
};
