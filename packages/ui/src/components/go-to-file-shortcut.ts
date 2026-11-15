/**
 * Go to file, as editors bind it: ⌘P on a Mac, Ctrl+P elsewhere. Ctrl+P is
 * left alone on a Mac, where it moves the cursor up a line in a text field.
 * Web only: native has no keyboard to listen to.
 */
const isMac =
  // oxlint-disable-next-line node-js/no-unsupported-features/node-builtins -- this runs in a browser or react-native, never node
  typeof navigator !== "undefined" &&
  // oxlint-disable-next-line node-js/no-unsupported-features/node-builtins -- same
  /Mac|iPhone|iPad/.test(navigator.userAgent);

export const goToFileShortcutLabel = isMac ? "⌘P" : "Ctrl+P";

export type ShortcutKeys = Pick<
  KeyboardEvent,
  "altKey" | "ctrlKey" | "key" | "metaKey" | "shiftKey"
>;

export const isGoToFileShortcut = (event: ShortcutKeys): boolean =>
  (isMac ? event.metaKey && !event.ctrlKey : event.ctrlKey && !event.metaKey) &&
  !event.altKey &&
  !event.shiftKey &&
  event.key.toLowerCase() === "p";
