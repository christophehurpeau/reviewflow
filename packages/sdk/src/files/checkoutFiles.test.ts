import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  symlinkSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { GitRepoFixture } from "../git/test/gitRepo.ts";
import { createGitRepo } from "../git/test/gitRepo.ts";
import {
  listCheckoutFiles,
  maxCheckoutFileBytes,
  parseCheckoutStatuses,
  readCheckoutFile,
  readCheckoutFileAtHead,
  resolveCheckoutPath,
  saveCheckoutFile,
} from "./checkoutFiles.ts";

let repo: GitRepoFixture | undefined;
let outside: string | undefined;

afterEach(() => {
  repo?.remove();
  repo = undefined;
  if (outside !== undefined) rmSync(outside, { recursive: true, force: true });
  outside = undefined;
});

const createRepo = (): GitRepoFixture => {
  repo = createGitRepo();
  return repo;
};

const createOutside = (): string => {
  outside = realpathSync(mkdtempSync(join(tmpdir(), "reviewflow-outside-")));
  return outside;
};

describe("listCheckoutFiles", () => {
  it("lists tracked, untracked and deleted files with their git state, not ignored ones", async () => {
    const { path, git, commit } = createRepo();
    mkdirSync(join(path, "src"));
    writeFileSync(join(path, "src/index.ts"), "export {};\n");
    writeFileSync(join(path, "gone.ts"), "x\n");
    writeFileSync(join(path, "removed.ts"), "x\n");
    writeFileSync(join(path, ".gitignore"), "dist\n");
    git(["add", "."]);
    commit();
    unlinkSync(join(path, "gone.ts"));
    git(["rm", "--quiet", "removed.ts"]);
    writeFileSync(join(path, "src/index.ts"), "export const a = 1;\n");
    writeFileSync(join(path, "staged.ts"), "x\n");
    git(["add", "staged.ts"]);
    writeFileSync(join(path, "new.md"), "# new\n");
    mkdirSync(join(path, "dist"));
    writeFileSync(join(path, "dist/out.js"), "x\n");

    const { paths, statuses } = await listCheckoutFiles(path);

    expect(paths).toEqual([
      ".gitignore",
      "gone.ts",
      "new.md",
      "removed.ts",
      "src/index.ts",
      "staged.ts",
    ]);
    expect(statuses).toEqual({
      "gone.ts": "deleted",
      "new.md": "untracked",
      "removed.ts": "deleted",
      "src/index.ts": "modified",
      "staged.ts": "added",
    });
  });
});

describe("parseCheckoutStatuses", () => {
  it("keeps a path with spaces whole", () => {
    expect(parseCheckoutStatuses(" M a b.ts\0?? c d/e.ts\0")).toEqual({
      "a b.ts": "modified",
      "c d/e.ts": "untracked",
    });
  });
});

describe("resolveCheckoutPath", () => {
  it("refuses a path escaping the checkout, textually or through a symlink", () => {
    const { path } = createRepo();
    const elsewhere = createOutside();
    writeFileSync(join(elsewhere, "secret"), "s\n");
    symlinkSync(join(elsewhere, "secret"), join(path, "link"));

    expect(resolveCheckoutPath({ checkout: path }, "../x")).toHaveProperty(
      "refused",
    );
    expect(
      resolveCheckoutPath({ checkout: path }, join(elsewhere, "secret")),
    ).toHaveProperty("refused");
    expect(resolveCheckoutPath({ checkout: path }, "link")).toEqual({
      refused: "link resolves outside the repository",
      resolvesTo: "outside",
    });
  });

  it("accepts a symlink into the main checkout when it is given", () => {
    const { path } = createRepo();
    const main = createOutside();
    writeFileSync(join(main, ".env"), "A=1\n");
    symlinkSync(join(main, ".env"), join(path, ".env"));

    expect(
      resolveCheckoutPath({ checkout: path, mainCheckout: main }, ".env"),
    ).toEqual({ realPath: join(main, ".env"), exists: true });
  });

  it("refuses anything inside .git", () => {
    const { path } = createRepo();
    expect(
      resolveCheckoutPath({ checkout: path }, ".git/hooks/pre-commit"),
    ).toHaveProperty("refused");
    expect(
      resolveCheckoutPath({ checkout: path }, "sub/.git/config"),
    ).toHaveProperty("refused");
  });

  it("refuses a directory", () => {
    const { path } = createRepo();
    mkdirSync(join(path, "src"));
    expect(resolveCheckoutPath({ checkout: path }, "src")).toEqual({
      refused: "src is not a file",
      resolvesTo: "directory",
    });
  });
});

describe("readCheckoutFile", () => {
  it("reads text, and tells binary, too large and absent apart", () => {
    const { path } = createRepo();
    writeFileSync(join(path, "a.ts"), "const a = 1;\n");
    writeFileSync(join(path, "image.png"), Buffer.from([0x89, 0x50, 0, 0x47]));
    writeFileSync(join(path, "big.txt"), "x".repeat(maxCheckoutFileBytes + 1));
    const roots = { checkout: path };

    expect(readCheckoutFile(roots, "a.ts")).toEqual({
      status: "text",
      source: "const a = 1;\n",
    });
    expect(readCheckoutFile(roots, "image.png")).toEqual({ status: "binary" });
    expect(readCheckoutFile(roots, "big.txt")).toEqual({
      status: "tooLarge",
      bytes: maxCheckoutFileBytes + 1,
      limit: maxCheckoutFileBytes,
    });
    expect(readCheckoutFile(roots, "missing.ts")).toEqual({
      status: "absent",
    });
  });

  it("reads a symlink to a file of the checkout as that file, naming it", () => {
    const { path } = createRepo();
    mkdirSync(join(path, "docs"));
    writeFileSync(join(path, "CLAUDE.md"), "# rules\n");
    symlinkSync("CLAUDE.md", join(path, "AGENTS.md"));
    symlinkSync("../CLAUDE.md", join(path, "docs/rules.md"));
    const roots = { checkout: path };

    expect(readCheckoutFile(roots, "AGENTS.md")).toEqual({
      status: "text",
      source: "# rules\n",
      link: { target: "CLAUDE.md", path: "CLAUDE.md" },
    });
    expect(readCheckoutFile(roots, "docs/rules.md")).toEqual({
      status: "text",
      source: "# rules\n",
      link: { target: "../CLAUDE.md", path: "CLAUDE.md" },
    });
  });

  it("tells why a symlink opens nothing rather than refusing it", () => {
    const { path } = createRepo();
    const elsewhere = createOutside();
    writeFileSync(join(elsewhere, "secret"), "s\n");
    mkdirSync(join(path, "src"));
    symlinkSync("src", join(path, "source"));
    symlinkSync("gone.md", join(path, "broken"));
    symlinkSync(join(elsewhere, "secret"), join(path, "away"));
    symlinkSync(".git/config", join(path, "config"));
    const roots = { checkout: path };

    expect(readCheckoutFile(roots, "source")).toEqual({
      status: "link",
      link: { target: "src", path: null },
      resolvesTo: "directory",
    });
    expect(readCheckoutFile(roots, "broken")).toEqual({
      status: "link",
      link: { target: "gone.md", path: null },
      resolvesTo: "missing",
    });
    expect(readCheckoutFile(roots, "away")).toEqual({
      status: "link",
      link: { target: join(elsewhere, "secret"), path: null },
      resolvesTo: "outside",
    });
    expect(readCheckoutFile(roots, "config")).toEqual({
      status: "link",
      link: { target: ".git/config", path: null },
      resolvesTo: "gitDirectory",
    });
  });

  it("names no checkout path for a symlink into the main checkout", () => {
    const { path } = createRepo();
    const main = createOutside();
    writeFileSync(join(main, ".env"), "A=1\n");
    symlinkSync(join(main, ".env"), join(path, ".env"));

    expect(
      readCheckoutFile({ checkout: path, mainCheckout: main }, ".env"),
    ).toEqual({
      status: "text",
      source: "A=1\n",
      link: { target: join(main, ".env"), path: null },
    });
  });

  it("still refuses a directory that is not a symlink", () => {
    const { path } = createRepo();
    mkdirSync(join(path, "src"));
    expect(readCheckoutFile({ checkout: path }, "src")).toEqual({
      refused: "src is not a file",
    });
  });
});

describe("saveCheckoutFile", () => {
  it("writes the text as typed, without adding a final newline", async () => {
    const { path } = createRepo();
    writeFileSync(join(path, "a.ts"), "old");

    const result = await saveCheckoutFile(
      { checkout: path },
      { path: "a.ts", source: "new", expectedSource: "old" },
    );

    expect(result).toEqual({ status: "saved", source: "new", warnings: [] });
    expect(readFileSync(join(path, "a.ts"), "utf8")).toBe("new");
  });

  it("refuses a file changed since it was opened, with what it holds now", async () => {
    const { path } = createRepo();
    writeFileSync(join(path, "a.ts"), "changed by the agent\n");

    const result = await saveCheckoutFile(
      { checkout: path },
      { path: "a.ts", source: "mine\n", expectedSource: "opened on\n" },
    );

    expect(result).toEqual({
      status: "conflict",
      source: "changed by the agent\n",
    });
    expect(readFileSync(join(path, "a.ts"), "utf8")).toBe(
      "changed by the agent\n",
    );
  });

  it("does not create a file that is gone", async () => {
    const { path } = createRepo();
    expect(
      await saveCheckoutFile(
        { checkout: path },
        { path: "deleted.ts", source: "x", expectedSource: "x" },
      ),
    ).toEqual({ refused: "deleted.ts no longer exists" });
  });
});

describe("readCheckoutFileAtHead", () => {
  it("reads the committed text whatever the disk holds, and a new file as absent", async () => {
    const { path, git, commit } = createRepo();
    writeFileSync(join(path, "a *.ts"), "committed\n");
    git(["add", "."]);
    commit();
    writeFileSync(join(path, "a *.ts"), "edited\n");
    writeFileSync(join(path, "new.ts"), "x\n");

    expect(await readCheckoutFileAtHead(path, "a *.ts")).toEqual({
      status: "text",
      source: "committed\n",
    });
    expect(await readCheckoutFileAtHead(path, "new.ts")).toEqual({
      status: "absent",
    });
  });

  it("reads nothing at an unborn HEAD, and refuses a path out of the checkout", async () => {
    repo = createGitRepo({ initialCommit: false });
    expect(await readCheckoutFileAtHead(repo.path, "a.ts")).toEqual({
      status: "absent",
    });
    expect(await readCheckoutFileAtHead(repo.path, "../a.ts")).toHaveProperty(
      "refused",
    );
  });
});
