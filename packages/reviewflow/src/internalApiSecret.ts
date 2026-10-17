import { timingSafeEqual } from "node:crypto";

const isExpectedSecret = (given: string, expected: string): boolean => {
  const givenBuffer = Buffer.from(given);
  const expectedBuffer = Buffer.from(expected);
  if (givenBuffer.length !== expectedBuffer.length) return false;
  return timingSafeEqual(givenBuffer, expectedBuffer);
};

export const hasInternalApiSecret = (
  authorization: string | undefined,
  secret: string,
): boolean => {
  const given = authorization?.startsWith("Bearer ")
    ? authorization.slice(7)
    : undefined;
  return given !== undefined && isExpectedSecret(given, secret);
};
