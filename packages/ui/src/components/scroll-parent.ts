/**
 * The nearest ancestor that scrolls vertically, which only exists on the web
 * (a DOM element); null when none does. Used to keep a closed file's header in
 * view under the diff toolbar.
 */
export const scrollParentOf = (element: HTMLElement): HTMLElement | null => {
  for (
    let parent = element.parentElement;
    parent !== null;
    parent = parent.parentElement
  ) {
    const { overflowY } = getComputedStyle(parent);
    if (overflowY === "auto" || overflowY === "scroll") return parent;
  }
  return null;
};

/** A CSS variable as `element` inherits it; "" without a DOM element (native). */
export const cssVariableOf = (element: unknown, name: string): string =>
  typeof HTMLElement !== "undefined" && element instanceof HTMLElement
    ? getComputedStyle(element).getPropertyValue(name).trim()
    : "";

/** How far `element`'s top is above the `stickyTop` pixels a sticky bar covers; negative below. */
const hiddenAbove = (
  element: HTMLElement,
  container: HTMLElement,
  stickyTop: number,
): number =>
  container.getBoundingClientRect().top +
  stickyTop -
  element.getBoundingClientRect().top;

/** Scrolls `element`'s top to just under the `stickyTop` pixels a sticky bar covers. */
export const scrollToTopOf = (
  element: HTMLElement,
  stickyTop: number,
): void => {
  const container = scrollParentOf(element);
  if (container === null) return;
  container.scrollTop -= hiddenAbove(element, container, stickyTop);
};

/**
 * Scrolls `element`'s scroll parent alone, the least that shows it whole
 * below the `stickyTop` pixels a pinned row covers: the page around it stays
 * where the reader has it, unlike `scrollIntoView`.
 */
export const revealWithinScrollParent = (
  element: HTMLElement,
  stickyTop: number,
): void => {
  const container = scrollParentOf(element);
  if (container === null) return;
  const bounds = container.getBoundingClientRect();
  const { top, bottom } = element.getBoundingClientRect();
  const hidden = bounds.top + stickyTop - top;
  if (hidden > 0) container.scrollTop -= hidden;
  else if (bottom > bounds.bottom) {
    container.scrollTop += bottom - bounds.bottom;
  }
};

/** As `scrollToTopOf`, only when `element`'s top is hidden above that bar. */
export const revealTopOf = (element: HTMLElement, stickyTop: number): void => {
  const container = scrollParentOf(element);
  if (container === null) return;
  const hidden = hiddenAbove(element, container, stickyTop);
  if (hidden > 0) container.scrollTop -= hidden;
};
