export type FileKind =
  | "config"
  | "css"
  | "file"
  | "html"
  | "image"
  | "javascript"
  | "json"
  | "jsx"
  | "lock"
  | "markdown"
  | "package"
  | "python"
  | "rust"
  | "shell"
  | "sql"
  | "svg"
  | "text"
  | "tsx"
  | "typescript"
  | "vue";

const lockFiles = new Set([
  "bun.lock",
  "bun.lockb",
  "composer.lock",
  "Gemfile.lock",
  "package-lock.json",
  "pnpm-lock.yaml",
  "poetry.lock",
  "yarn.lock",
]);

const kindByExtension: Readonly<Record<string, FileKind>> = {
  ts: "typescript",
  mts: "typescript",
  cts: "typescript",
  tsx: "tsx",
  js: "javascript",
  mjs: "javascript",
  cjs: "javascript",
  jsx: "jsx",
  json: "json",
  jsonc: "json",
  json5: "json",
  md: "markdown",
  mdx: "markdown",
  css: "css",
  scss: "css",
  sass: "css",
  less: "css",
  html: "html",
  htm: "html",
  png: "image",
  jpg: "image",
  jpeg: "image",
  gif: "image",
  webp: "image",
  avif: "image",
  ico: "image",
  svg: "svg",
  yaml: "config",
  yml: "config",
  toml: "config",
  ini: "config",
  env: "config",
  sh: "shell",
  bash: "shell",
  zsh: "shell",
  fish: "shell",
  sql: "sql",
  py: "python",
  rs: "rust",
  vue: "vue",
  txt: "text",
  log: "text",
};

/** What a file is, from its name, for the icon standing for it. */
export const fileKindOf = (path: string): FileKind => {
  const name = path.slice(path.lastIndexOf("/") + 1);
  if (lockFiles.has(name) || name.endsWith(".lock")) return "lock";
  if (name === "package.json") return "package";
  const dot = name.lastIndexOf(".");
  const known =
    dot > 0 ? kindByExtension[name.slice(dot + 1).toLowerCase()] : undefined;
  if (known !== undefined) return known;
  // a dotfile without a known extension (.gitignore, .npmrc, .env)
  if (name.startsWith(".")) return "config";
  return "file";
};
