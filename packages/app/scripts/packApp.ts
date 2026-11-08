import { cpSync, existsSync, rmSync } from "node:fs";
import { join } from "node:path";

const packageDirectory = join(import.meta.dirname, "..");
const serverBuild = join(packageDirectory, "build", "index-node.mjs");
const exportedClient = join(packageDirectory, "..", "app-expo", "dist");
const packagedClient = join(packageDirectory, "client");

const refuse = (message: string): never => {
  throw new Error(`@reviewflow/app prepack: ${message}`);
};

if (!existsSync(serverBuild)) {
  refuse(
    `${serverBuild} is missing: run pnpm --filter @reviewflow/app run build`,
  );
}
if (!existsSync(join(exportedClient, "index.html"))) {
  refuse(
    `no exported expo app in ${exportedClient}: run pnpm --filter @reviewflow/app-expo run build`,
  );
}

rmSync(packagedClient, { recursive: true, force: true });
cpSync(exportedClient, packagedClient, { recursive: true });
