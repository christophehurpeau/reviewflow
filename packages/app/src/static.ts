import { existsSync, statSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { extname, join, normalize, sep } from "node:path";

// `build/` and `src/` are both one level inside the package, so these relative
// paths hold from either.
const packagedDistDirectory = join(import.meta.dirname, "..", "client");
const workspaceDistDirectory = join(
  import.meta.dirname,
  "..",
  "..",
  "app-expo",
  "dist",
);

/**
 * The web export of the expo app: the copy `prepack` puts in the
 * published package, or `packages/app-expo/dist` in the repository.
 */
export const defaultDistDirectory = existsSync(
  join(packagedDistDirectory, "index.html"),
)
  ? packagedDistDirectory
  : workspaceDistDirectory;

export const noAppMessage =
  "reviewflow app: no exported expo app found.\n" +
  "Run it in dev with: pnpm --filter @reviewflow/app-expo run start\n" +
  "or export it (pnpm --filter @reviewflow/app-expo run build) so packages/app-expo/dist exists.\n";

const contentTypes: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".ico": "image/x-icon",
  ".webp": "image/webp",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".txt": "text/plain; charset=utf-8",
  ".wasm": "application/wasm",
};

export interface StaticAnswer {
  status: number;
  contentType: string;
  body: Buffer | string;
}

const isFile = (path: string): boolean => {
  try {
    return statSync(path).isFile();
  } catch {
    return false;
  }
};

const notFound = (): StaticAnswer => ({
  status: 404,
  contentType: "text/plain; charset=utf-8",
  body: "not found\n",
});

/**
 * A file of `distDirectory`, or `index.html` for a path with no file (the
 * client router owns those). A path that leaves the directory is a 404, and a
 * missing asset (a path with an extension) is a 404 rather than the page, so a
 * broken script url does not come back as html.
 */
export const serveStatic = async (
  distDirectory: string,
  pathname: string,
): Promise<StaticAnswer> => {
  if (!existsSync(join(distDirectory, "index.html"))) {
    return {
      status: 200,
      contentType: "text/plain; charset=utf-8",
      body: noAppMessage,
    };
  }

  let decoded: string;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return notFound();
  }
  const target = normalize(join(distDirectory, decoded));
  if (target !== distDirectory && !target.startsWith(distDirectory + sep)) {
    return notFound();
  }

  let file = target;
  if (!isFile(target)) {
    if (extname(decoded) !== "") return notFound();
    file = join(distDirectory, "index.html");
  }

  return {
    status: 200,
    contentType:
      contentTypes[extname(file).toLowerCase()] ?? "application/octet-stream",
    body: await readFile(file),
  };
};
