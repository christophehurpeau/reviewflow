import type { NextFunction, Request, Response, Router } from "express";
import express from "express";
import type { Probot } from "probot";
import type { AppContext } from "./context/AppContext.ts";
import { getExistingAccountContext } from "./context/accountContext.ts";
import { syncOrg } from "./events/account-handlers/actions/syncOrg.ts";
import { syncTeamsAndTeamMembers } from "./events/account-handlers/actions/syncTeams.ts";
import { syncUser } from "./events/account-handlers/actions/syncUser.ts";
import { syncRepository } from "./events/repository-handlers/actions/syncRepository.ts";
import { deleteRepositoryData } from "./events/repository-handlers/utils/deleteRepositoryData.ts";
import { hasInternalApiSecret } from "./internalApiSecret.ts";

/**
 * Server to server routes for the webapp server: it holds no github app
 * credentials and runs in another process, so anything needing the installation
 * octokit or the account contexts cached here goes through this router.
 */

const readNumber = (value: unknown): number | undefined => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
};

const readString = (value: unknown): string | undefined =>
  typeof value === "string" && value !== "" ? value : undefined;

const isNotFound = (error: unknown): boolean =>
  typeof error === "object" &&
  error !== null &&
  "status" in error &&
  error.status === 404;

type OrgMemberRole = "admin" | "member";

export default function internalApiRouter(
  probot: Probot,
  { mongoStores }: AppContext,
): Router {
  const secret = process.env.INTERNAL_API_SECRET;
  if (!secret) {
    throw new Error("Missing env variable: INTERNAL_API_SECRET");
  }

  const router = express.Router();

  router.use(express.json());

  router.use((req: Request, res: Response, next: NextFunction) => {
    if (!hasInternalApiSecret(req.headers.authorization, secret)) {
      res.status(401).json({ error: "Invalid internal api secret" });
      return;
    }

    next();
  });

  router.post("/sync/org", (req, res, next) => {
    const orgId = readNumber(req.body?.orgId);
    if (!orgId) {
      res.status(400).json({ error: "Invalid orgId" });
      return;
    }

    (async () => {
      const org = await mongoStores.orgs.findByKey(orgId);
      if (!org) {
        res.status(404).json({ error: "Unknown organization" });
        return;
      }

      const octokit = await probot.auth(org.installationId);
      const orgInfo = { id: org._id, login: org.login };

      await syncOrg(
        mongoStores,
        octokit.rest,
        octokit.paginate,
        org.installationId,
        orgInfo,
      );
      await syncTeamsAndTeamMembers(
        mongoStores,
        octokit.rest,
        octokit.paginate,
        orgInfo,
      );

      // the teams the sync just rewrote are cached per account context, and
      // only the membership webhooks refresh them otherwise
      const accountContext = await getExistingAccountContext({
        type: "Organization",
        id: org._id,
        login: org.login,
      });
      await accountContext?.updateGithubTeamMembers();

      res.status(204).end();
    })().catch(next);
  });

  router.post("/sync/user", (req, res, next) => {
    const userId = readNumber(req.body?.userId);
    if (!userId) {
      res.status(400).json({ error: "Invalid userId" });
      return;
    }

    (async () => {
      const user = await mongoStores.users.findByKey(userId);
      if (!user?.installationId) {
        res
          .status(404)
          .json({ error: "Reviewflow is not installed for this user" });
        return;
      }

      const octokit = await probot.auth(user.installationId);

      await syncUser(mongoStores, octokit.rest, user.installationId, {
        id: user._id,
        login: user.login,
      });

      res.status(204).end();
    })().catch(next);
  });

  router.post("/sync/repository", (req, res, next) => {
    const repositoryId = readNumber(req.body?.repositoryId);
    if (!repositoryId) {
      res.status(400).json({ error: "Invalid repositoryId" });
      return;
    }

    (async () => {
      const repository = await mongoStores.repositories.findByKey(repositoryId);
      if (!repository) {
        res.status(404).json({ error: "Unknown repository" });
        return;
      }

      const account =
        repository.account.type === "Organization"
          ? await mongoStores.orgs.findByKey(repository.account.id)
          : await mongoStores.users.findByKey(repository.account.id);

      if (!account?.installationId) {
        res
          .status(404)
          .json({ error: "Reviewflow is not installed for this account" });
        return;
      }

      const octokit = await probot.auth(account.installationId);

      await syncRepository({ mongoStores, octokit, repository });

      res.status(204).end();
    })().catch(next);
  });

  router.post("/cleanup/repository", (req, res, next) => {
    const repositoryId = readNumber(req.body?.repositoryId);
    if (!repositoryId) {
      res.status(400).json({ error: "Invalid repositoryId" });
      return;
    }

    (async () => {
      await deleteRepositoryData({ mongoStores, repositoryId });
      res.status(204).end();
    })().catch(next);
  });

  // read live from github on every call: it gates org-wide settings, and the
  // synced members carry no role
  router.post("/org/member-role", (req, res, next) => {
    const orgId = readNumber(req.body?.orgId);
    const userLogin = readString(req.body?.userLogin);
    if (!orgId || !userLogin) {
      res.status(400).json({ error: "Invalid orgId or userLogin" });
      return;
    }

    (async () => {
      const org = await mongoStores.orgs.findByKey(orgId);
      if (!org?.installationId) {
        res.status(404).json({ error: "Unknown organization" });
        return;
      }

      const octokit = await probot.auth(org.installationId);
      const role = await octokit.rest.orgs
        .getMembershipForUser({ org: org.login, username: userLogin })
        .then(({ data }): OrgMemberRole | null => {
          if (data.state !== "active") return null;
          return data.role === "admin" ? "admin" : "member";
        })
        .catch((error: unknown) => {
          if (isNotFound(error)) return null;
          throw error;
        });

      res.status(200).json({ role });
    })().catch(next);
  });

  router.post("/slack/org-installed", (req, res, next) => {
    const orgId = readNumber(req.body?.orgId);
    const orgLogin = readString(req.body?.orgLogin);
    if (!orgId || !orgLogin) {
      res.status(400).json({ error: "Invalid orgId or orgLogin" });
      return;
    }

    (async () => {
      const accountContext = await getExistingAccountContext({
        type: "Organization",
        id: orgId,
        login: orgLogin,
      });
      await accountContext?.initSlack();
      res.status(204).end();
    })().catch(next);
  });

  router.post("/slack/member-linked", (req, res, next) => {
    const orgId = readNumber(req.body?.orgId);
    const orgLogin = readString(req.body?.orgLogin);
    const userId = readNumber(req.body?.userId);
    const userLogin = readString(req.body?.userLogin);
    if (!orgId || !orgLogin || !userId || !userLogin) {
      res.status(400).json({ error: "Invalid org or user" });
      return;
    }

    (async () => {
      const accountContext = await getExistingAccountContext({
        type: "Organization",
        id: orgId,
        login: orgLogin,
      });
      await accountContext?.slack.updateSlackMember(userId, userLogin);
      res.status(204).end();
    })().catch(next);
  });

  return router;
}
