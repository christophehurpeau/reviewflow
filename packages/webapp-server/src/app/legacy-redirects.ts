import type { Request, Response, Router } from "express";
import { authCookieName, verifyAuthCookie } from "../auth/authCookie.ts";
import { webappUrl } from "../webappUrl.ts";

const movedPermanently = (res: Response, path: string): void => {
  res.redirect(301, webappUrl(path));
};

const segment = (value: string): string => encodeURIComponent(value);

interface RepositoryParams {
  owner: string;
  repository: string;
}

/**
 * The old page took an owner without telling a personal account from an
 * organization, which are two routes in the webapp: the signed in login decides
 * which one, so the redirect is not a permanent one.
 */
const repositoryPath = async (
  req: Request<RepositoryParams>,
): Promise<string> => {
  const { owner, repository } = req.params;
  const cookie: string | undefined = req.cookies[authCookieName];
  const authInfo = cookie
    ? await verifyAuthCookie(cookie, req.headers["user-agent"])
    : undefined;

  return authInfo?.login.toLowerCase() === owner.toLowerCase()
    ? `/user/repositories/${segment(repository)}`
    : `/org/${segment(owner)}/repositories/${segment(repository)}`;
};

/**
 * Every screen used to be rendered by this server under `/app`; they now live in
 * the webapp, at the root. Links pointing at the old paths are still out there —
 * bookmarks, and the pull request bodies and slack messages written back then.
 */
export default function legacyRedirects(router: Router): void {
  router.get("/", (req, res) => {
    movedPermanently(res, "/");
  });

  router.get("/user", (req, res) => {
    movedPermanently(res, "/user");
  });

  router.get("/user/force-sync", (req, res) => {
    movedPermanently(res, "/user");
  });

  router.get("/repositories", (req, res) => {
    movedPermanently(res, "/user/repositories");
  });

  router.get("/org/:org", (req, res) => {
    movedPermanently(res, `/org/${segment(req.params.org)}`);
  });

  router.get("/org/:org/force-sync", (req, res) => {
    movedPermanently(res, `/org/${segment(req.params.org)}`);
  });

  router.get("/repository/:owner/:repository", async (req, res, next) => {
    try {
      res.redirect(webappUrl(await repositoryPath(req)));
    } catch (error) {
      next(error);
    }
  });
}
