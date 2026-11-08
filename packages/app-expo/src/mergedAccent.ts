import type { Accent } from "alouette";

/**
 * Not an alouette accent: `build-theme.ts` generates its two themes
 * (`palette-violet.css`, `violetThemeVariables.ts`), so the name is cast past
 * alouette's closed union. A merged pull request, as on GitHub: done, nothing
 * left to do.
 */
export const mergedAccent = "violet" as Accent;
