import { Router } from "express";
import type { Probot } from "probot";
import auth from "./app/auth.tsx";
import home from "./app/home.tsx";
import orgSettings from "./app/org-settings.tsx";
import repository from "./app/repository.tsx";
import slackConnect from "./app/slack-connect.tsx";
import userSettings from "./app/user-settings.tsx";
import type { AppContext } from "./context/AppContext";

export default async function appRouter(
  app: Probot,
  { mongoStores }: AppContext,
): Promise<Router> {
  const octokitApp = await app.auth();

  const router = Router();
  auth(router);
  repository(router, octokitApp);
  home(router, octokitApp, mongoStores);
  orgSettings(router, octokitApp, mongoStores);
  userSettings(router, octokitApp, mongoStores);
  slackConnect(router, mongoStores);
  return router;
}
