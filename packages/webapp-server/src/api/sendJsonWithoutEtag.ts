import type { Response } from "express";

/**
 * `res.json` adds a weak ETag to every answer. Only a successful GET is
 * conditional: on an error or a POST a validator would invite a conditional
 * request that is never answered 304, so those answers skip it.
 */
export const sendJsonWithoutEtag = (res: Response, body: unknown): void => {
  res.type("json").end(JSON.stringify(body));
};
