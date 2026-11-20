import { AccentScope, ScopedTheme, useCurrentTheme } from "alouette";
import type { ReactNode } from "react";

interface EditorInkScopeProps {
  children: ReactNode;
}

/**
 * Links are inked in the info accent, like the rendered markdown, and marked
 * passages (`highlights`) in the warning one, like a highlighter. An accent
 * theme also retints the surface, borders and selection, so each is applied
 * only long enough to capture its `--color-accent` into `--md-link` and
 * `--md-highlight`, then the current theme is restored around the editor.
 */
export function EditorInkScope({ children }: EditorInkScopeProps): ReactNode {
  const theme = useCurrentTheme();
  return (
    <AccentScope accent="info">
      <div className="markdown-editor-link-ink">
        <AccentScope accent="warning">
          <div className="markdown-editor-highlight-ink">
            <ScopedTheme theme={theme}>{children}</ScopedTheme>
          </div>
        </AccentScope>
      </div>
    </AccentScope>
  );
}
