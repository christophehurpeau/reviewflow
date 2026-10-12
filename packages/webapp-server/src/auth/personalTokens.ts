import { createHash, randomBytes } from "node:crypto";

/** lets secret scanners recognise a leaked token */
export const personalTokenPrefix = "rfp_";

const displayedSecretLength = 4;

/** a plain sha-256 is enough: the token is 32 random bytes, not a password */
export const hashPersonalToken = (token: string): string =>
  createHash("sha256").update(token).digest("hex");

export interface GeneratedPersonalToken {
  token: string;
  hash: string;
  prefix: string;
}

export const generatePersonalToken = (): GeneratedPersonalToken => {
  const token = `${personalTokenPrefix}${randomBytes(32).toString("base64url")}`;
  return {
    token,
    hash: hashPersonalToken(token),
    prefix: token.slice(0, personalTokenPrefix.length + displayedSecretLength),
  };
};
