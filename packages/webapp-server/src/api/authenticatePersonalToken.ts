import type { Request } from "express";
import type { MongoStores, PersonalToken } from "reviewflow-core";
import {
  hashPersonalToken,
  personalTokenPrefix,
} from "../auth/personalTokens.ts";
import { ApiError } from "./apiErrors.ts";

export interface ApiAuth {
  token: Pick<PersonalToken, "_id" | "created" | "name">;
  user: { id: number; login: string };
}

const bearerPrefix = "Bearer ";
const lastUseWriteIntervalMs = 60_000;

const readBearerToken = (header: string | undefined): string | undefined =>
  header?.startsWith(bearerPrefix)
    ? header.slice(bearerPrefix.length)
    : undefined;

const isLastUseFresh = (stored: PersonalToken, now: Date, ip: string) =>
  stored.lastUsedIp === ip &&
  stored.lastUsedAt !== undefined &&
  now.getTime() - stored.lastUsedAt.getTime() < lastUseWriteIntervalMs;

/**
 * At most one write a minute per token, unless the ip changes: a leaked token
 * used from elsewhere must show up at once. Never awaited, and never counted
 * as a change to the document.
 */
const recordUse = (
  mongoStores: MongoStores,
  stored: PersonalToken,
  ip: string,
): void => {
  const now = new Date();
  if (isLastUseFresh(stored, now, ip)) return;

  mongoStores.personalTokens
    .partialUpdateByKey(
      stored._id,
      { $set: { lastUsedAt: now, lastUsedIp: ip } },
      undefined,
      { touchUpdated: false },
    )
    .catch((error: unknown) => {
      console.error("Could not record the use of a personal token", error);
    });
};

export const authenticatePersonalToken = async (
  mongoStores: MongoStores,
  req: Request,
): Promise<ApiAuth> => {
  const token = readBearerToken(req.headers.authorization);
  if (!token?.startsWith(personalTokenPrefix)) {
    throw new ApiError(
      "unauthenticated",
      `Send a personal token as "Authorization: Bearer ${personalTokenPrefix}…"`,
    );
  }

  const stored = await mongoStores.personalTokens.findOne({
    hash: hashPersonalToken(token),
    revokedAt: { $exists: false },
  });
  if (!stored) {
    throw new ApiError("unauthenticated", "Unknown or revoked token");
  }

  recordUse(mongoStores, stored, req.ip ?? "unknown");

  return {
    token: { _id: stored._id, name: stored.name, created: stored.created },
    user: { id: stored.userId, login: stored.userLogin },
  };
};
