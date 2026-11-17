import { describe, expect, test } from "vitest";
import type { ShortcutKeys } from "./go-to-file-shortcut.ts";
import {
  goToFileShortcutLabel,
  isGoToFileShortcut,
} from "./go-to-file-shortcut.ts";

const keydown = (init: Partial<ShortcutKeys>): ShortcutKeys => ({
  key: "",
  metaKey: false,
  ctrlKey: false,
  altKey: false,
  shiftKey: false,
  ...init,
});

const mac = goToFileShortcutLabel === "⌘P";
const modifier = mac ? { metaKey: true } : { ctrlKey: true };
const otherModifier = mac ? { ctrlKey: true } : { metaKey: true };

describe("isGoToFileShortcut", () => {
  test("the platform's modifier with P", () => {
    expect(isGoToFileShortcut(keydown({ ...modifier, key: "p" }))).toBe(true);
    expect(isGoToFileShortcut(keydown({ ...modifier, key: "P" }))).toBe(true);
  });

  test("not the other platform's modifier", () => {
    expect(isGoToFileShortcut(keydown({ ...otherModifier, key: "p" }))).toBe(
      false,
    );
  });

  test("not with shift or alt, nor another key, nor P alone", () => {
    expect(
      isGoToFileShortcut(keydown({ ...modifier, shiftKey: true, key: "p" })),
    ).toBe(false);
    expect(
      isGoToFileShortcut(keydown({ ...modifier, altKey: true, key: "p" })),
    ).toBe(false);
    expect(isGoToFileShortcut(keydown({ ...modifier, key: "o" }))).toBe(false);
    expect(isGoToFileShortcut(keydown({ key: "p" }))).toBe(false);
  });
});
