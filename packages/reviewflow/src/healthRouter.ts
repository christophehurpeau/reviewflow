import { Router } from "express";
import type { MongoStores } from "reviewflow-core";
import { createHealthChecker, healthHttpStatus } from "reviewflow-core";

/** for load balancers and container probes, which read the HTTP status only */
export const healthRouter = (
  mongoStores: Pick<MongoStores, "connection">,
): Router => {
  const router = Router();
  const healthChecker = createHealthChecker(mongoStores);

  router.get("/api/health", async (_req, res) => {
    const status = await healthChecker.check();
    res.set("Cache-Control", "no-store");
    res.status(healthHttpStatus(status));
    res.type("json").end(JSON.stringify({ status }));
  });

  return router;
};
