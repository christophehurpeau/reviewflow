import { Router } from "express";
import type { ResourcesContext } from "./ResourcesContext.ts";
import auth from "./app/auth.ts";
import slackConnect from "./app/slack-connect.ts";

/**
 * Only the oauth redirect flows are served here: every screen lives in the
 * webapp and reads its data through the liwi resources websocket.
 */
export default function appRouter({ mongoStores }: ResourcesContext): Router {
  const router = Router();
  auth(router);
  slackConnect(router, mongoStores);
  return router;
}
