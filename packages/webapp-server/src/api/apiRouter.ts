import type { RequestHandler, Response } from "express";
import express, { Router } from "express";
import { createToPrDetail } from "reviewflow-core";
import type { ResourcesContext } from "../ResourcesContext.ts";
import {
  ApiError,
  apiErrorHandler,
  rateLimitedError,
  sendApiError,
} from "./apiErrors.ts";
import type { ApiAuth } from "./authenticatePersonalToken.ts";
import { authenticatePersonalToken } from "./authenticatePersonalToken.ts";
import { lookupPrs, parseLookupTargets } from "./prsLookup.ts";
import { createRateLimiter } from "./rateLimiter.ts";
import { resolveRepository } from "./resolveRepository.ts";
import { resolveTokenAccounts } from "./tokenAccounts.ts";

/** 60 requests at once, then one a second: a poll every few seconds fits */
const tokenLimits = { capacity: 60, refillPerSecond: 1 };

/** checked before the token lookup, so guessing and floods cost no query */
const failedAuthLimits = { capacity: 10, refillPerSecond: 10 / 60 };

/** 200 targets of a repository and a branch name stay far below it */
const lookupBodyLimit = "100kb";

const apiAuthOf = (res: Response): ApiAuth => res.locals.apiAuth as ApiAuth;

const isUnauthenticated = (error: unknown): boolean =>
  error instanceof ApiError && error.code === "unauthenticated";

/**
 * Read-only api for tools outside the webapp, authenticated by personal tokens
 * only: the cookie session never reaches it, and these tokens never reach the
 * resources websocket. No CORS headers: a browser must not hold a token.
 * Documented in docs/api.md.
 */
export default function apiRouter({ mongoStores }: ResourcesContext): Router {
  const router = Router();
  const tokenLimiter = createRateLimiter(tokenLimits);
  const failedAuthLimiter = createRateLimiter(failedAuthLimits);

  const authenticate: RequestHandler = async (req, res, next) => {
    const ip = req.ip ?? "unknown";
    const blockedFor = failedAuthLimiter.retryAfter(ip);
    if (blockedFor !== undefined) throw rateLimitedError(blockedFor);

    const auth = await authenticatePersonalToken(mongoStores, req).catch(
      (error: unknown) => {
        if (isUnauthenticated(error)) failedAuthLimiter.consume(ip);
        throw error;
      },
    );

    const waitFor = tokenLimiter.consume(auth.token._id);
    if (waitFor !== undefined) throw rateLimitedError(waitFor);

    res.locals.apiAuth = auth;
    next();
  };

  router.use(authenticate);

  router.get("/me/v1", async (req, res) => {
    const auth = apiAuthOf(res);
    const accounts = await resolveTokenAccounts(mongoStores, auth);

    res.json({
      user: auth.user,
      accounts: accounts.map(({ id, login, type, teams }) => ({
        id,
        login,
        type,
        teams: teams.map((team) => ({
          id: team.id,
          slug: team.slug,
          name: team.name,
        })),
      })),
      token: {
        name: auth.token.name,
        createdAt: auth.token.created.toISOString(),
        scopes: ["read"],
      },
      serverTime: new Date().toISOString(),
    });
  });

  router.get("/pr/v1/:owner/:repo/:number", async (req, res) => {
    const auth = apiAuthOf(res);
    const { owner, repo, number } = req.params;
    const prNumber = /^[1-9]\d{0,14}$/.test(number) ? Number(number) : null;

    const resolved = await resolveRepository(mongoStores, auth, owner, repo);
    // 403 is decided on the account alone, whether or not the pull request
    // exists, so it is not a way to probe private repositories
    if (resolved.status === "forbidden") {
      throw new ApiError("forbidden", "The token cannot read this account");
    }

    const pr =
      resolved.status === "ok" && prNumber !== null
        ? await mongoStores.prs.findOne({
            "account.id": resolved.account.id,
            "repo.id": resolved.repository._id,
            "pr.number": prNumber,
          })
        : undefined;
    if (!pr) throw new ApiError("notFound", "Pull request not found");

    res.json(
      createToPrDetail({
        userId: auth.user.id,
        accounts: [
          { accountId: resolved.account.id, teams: resolved.account.teams },
        ],
      })(pr),
    );
  });

  router.post(
    "/prs-lookup/v1",
    // runs after authentication: an anonymous body is never parsed
    (req, res, next) => {
      express.json({ limit: lookupBodyLimit })(req, res, (error?: unknown) => {
        next(
          error
            ? new ApiError(
                "badRequest",
                "The body is not valid JSON, or is too large",
              )
            : undefined,
        );
      });
    },
    async (req, res) => {
      const auth = apiAuthOf(res);
      const targets = parseLookupTargets(req.body);

      res.json({ results: await lookupPrs(mongoStores, auth, targets) });
    },
  );

  router.use((req, res) => {
    sendApiError(res, "notFound", "Unknown endpoint");
  });
  router.use(apiErrorHandler);

  return router;
}
