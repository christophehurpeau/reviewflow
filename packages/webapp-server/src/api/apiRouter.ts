import { Router } from "express";
import type { ResourcesContext } from "../ResourcesContext.ts";
import { apiErrorHandler, sendApiError } from "./apiErrors.ts";
import { authenticatePersonalToken } from "./authenticatePersonalToken.ts";
import { resolveTokenAccounts } from "./tokenAccounts.ts";

/**
 * Read-only api for tools outside the webapp, authenticated by personal tokens
 * only: the cookie session never reaches it, and these tokens never reach the
 * resources websocket. No CORS headers: a browser must not hold a token.
 * Documented in docs/api.md.
 */
export default function apiRouter({ mongoStores }: ResourcesContext): Router {
  const router = Router();

  router.get("/me/v1", async (req, res) => {
    const auth = await authenticatePersonalToken(mongoStores, req);
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

  router.use((req, res) => {
    sendApiError(res, "notFound", "Unknown endpoint");
  });
  router.use(apiErrorHandler);

  return router;
}
