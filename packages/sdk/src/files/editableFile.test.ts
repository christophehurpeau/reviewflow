import {
  chmodSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { ValidateEditableFile } from "./editableFile.ts";
import { readEditableFile, saveEditableFile } from "./editableFile.ts";

let root: string;
let path: string;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "reviewflow-editable-file-"));
  path = join(root, "nested", "settings.json");
});

afterEach(() => {
  rmSync(root, { force: true, recursive: true });
});

const accept: ValidateEditableFile = () => ({ warnings: [] });
const write = (contents: string): void => {
  mkdirSync(join(root, "nested"), { recursive: true });
  writeFileSync(path, contents);
};
const read = (): string => readFileSync(path, "utf8");

describe("readEditableFile", () => {
  it("answers an empty text for a file that does not exist", () => {
    expect(readEditableFile(path)).toEqual({ source: "", exists: false });
  });

  it("reads what is on disk each time", () => {
    write("one\n");
    expect(readEditableFile(path)).toEqual({ source: "one\n", exists: true });
    write("two\n");
    expect(readEditableFile(path).source).toBe("two\n");
  });

  it("answers an existing empty file as existing", () => {
    write("");
    expect(readEditableFile(path)).toEqual({ source: "", exists: true });
  });
});

describe("saveEditableFile", () => {
  it("creates the missing directories and ends the text with a newline", async () => {
    expect(
      await saveEditableFile({
        path,
        source: "{}",
        expectedSource: "",
        validate: accept,
      }),
    ).toEqual({ status: "saved", source: "{}\n", warnings: [] });
    expect(read()).toBe("{}\n");
    expect(readdirSync(join(root, "nested"))).toEqual(["settings.json"]);
  });

  it("keeps the text as it is when asked not to add a newline", async () => {
    await saveEditableFile({
      path,
      source: "{}",
      validate: accept,
      trailingNewline: false,
    });
    expect(read()).toBe("{}");
  });

  it("does not turn an empty text into a newline", async () => {
    await saveEditableFile({ path, source: "", validate: accept });
    expect(read()).toBe("");
  });

  it("replaces a file that has not changed since it was opened", async () => {
    write("a\n");
    const result = await saveEditableFile({
      path,
      source: "b\n",
      expectedSource: "a\n",
      validate: accept,
    });
    expect(result.status).toBe("saved");
    expect(read()).toBe("b\n");
  });

  it("skips the changed-since-opened check without an expected text", async () => {
    write("elsewhere\n");
    await saveEditableFile({ path, source: "b\n", validate: accept });
    expect(read()).toBe("b\n");
  });

  /** The same file is edited by hand; the last writer must not win silently. */
  it("refuses a file that changed since it was opened, with the text on disk", async () => {
    write("elsewhere\n");
    expect(
      await saveEditableFile({
        path,
        source: "b\n",
        expectedSource: "a\n",
        validate: accept,
      }),
    ).toEqual({ status: "conflict", source: "elsewhere\n", exists: true });
    expect(read()).toBe("elsewhere\n");
  });

  it("refuses a file created since the editor opened on a missing one", async () => {
    write("created elsewhere\n");
    expect(
      await saveEditableFile({
        path,
        source: "b\n",
        expectedSource: "",
        validate: accept,
      }),
    ).toMatchObject({ status: "conflict", source: "created elsewhere\n" });
  });

  it("refuses a file that is gone since the editor opened on its text", async () => {
    expect(
      await saveEditableFile({
        path,
        source: "b\n",
        expectedSource: "a\n",
        validate: accept,
      }),
    ).toEqual({ status: "conflict", source: "", exists: false });
  });

  it("refuses to create over an existing file when null is expected", async () => {
    write("a\n");
    expect(
      await saveEditableFile({
        path,
        source: "b\n",
        expectedSource: null,
        validate: accept,
      }),
    ).toMatchObject({ status: "conflict", source: "a\n", exists: true });
    expect(read()).toBe("a\n");
  });

  it("creates a file when null is expected and none exists", async () => {
    const result = await saveEditableFile({
      path,
      source: "b\n",
      expectedSource: null,
      validate: accept,
    });
    expect(result.status).toBe("saved");
  });

  it("refuses a source the validation refuses and leaves the file alone", async () => {
    write("a\n");
    expect(
      await saveEditableFile({
        path,
        source: "bad",
        expectedSource: "a\n",
        validate: (text) =>
          text.startsWith("bad") ? { error: "no bad text" } : { warnings: [] },
      }),
    ).toEqual({ status: "invalid", error: "no bad text" });
    expect(read()).toBe("a\n");
  });

  it("validates a broken file's replacement, not the file on disk", async () => {
    write("broken");
    const seen: string[] = [];
    await saveEditableFile({
      path,
      source: "fixed",
      expectedSource: "broken",
      validate: (text) => {
        seen.push(text);
        return { warnings: [] };
      },
    });
    expect(seen).toEqual(["fixed\n"]);
  });

  it("reports a validation that throws as a refusal", async () => {
    expect(
      await saveEditableFile({
        path,
        source: "x",
        validate: () => {
          throw new Error("could not parse");
        },
      }),
    ).toEqual({ status: "invalid", error: "could not parse" });
    expect(readdirSync(root)).toEqual([]);
  });

  it("waits for an async validation and returns its warnings", async () => {
    const result = await saveEditableFile({
      path,
      source: "x",
      validate: async () => {
        await Promise.resolve();
        return { warnings: ["heads up"] };
      },
    });
    expect(result).toEqual({
      status: "saved",
      source: "x\n",
      warnings: ["heads up"],
    });
    expect(read()).toBe("x\n");
  });

  it("keeps the mode of an existing file", async () => {
    write("a\n");
    chmodSync(path, 0o600);
    await saveEditableFile({ path, source: "b\n", validate: accept });
    // oxlint-disable-next-line no-bitwise
    expect(statSync(path).mode & 0o777).toBe(0o600);
  });

  it("leaves no temporary file behind", async () => {
    write("a\n");
    await saveEditableFile({ path, source: "b\n", validate: accept });
    expect(readdirSync(join(root, "nested"))).toEqual(["settings.json"]);
  });

  it("cleans up and rethrows when the target cannot be replaced", async () => {
    // a directory at the target path: the rename over it fails
    mkdirSync(path, { recursive: true });
    await expect(
      saveEditableFile({ path, source: "b\n", validate: accept }),
    ).rejects.toThrow();
    expect(readdirSync(join(root, "nested"))).toEqual(["settings.json"]);
  });

  /** A file kept in a dotfiles repo must stay linked to it. */
  it("writes through a symlink rather than replacing it", async () => {
    const repo = join(root, "dotfiles");
    mkdirSync(repo);
    writeFileSync(join(repo, "settings.json"), "a\n");
    mkdirSync(join(root, "nested"));
    symlinkSync(join(repo, "settings.json"), path);

    await saveEditableFile({
      path,
      source: "b\n",
      expectedSource: "a\n",
      validate: accept,
    });

    expect(lstatSync(path).isSymbolicLink()).toBe(true);
    expect(readFileSync(join(repo, "settings.json"), "utf8")).toBe("b\n");
    expect(readdirSync(repo)).toEqual(["settings.json"]);
  });
});
