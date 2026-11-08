import type { ReactNode } from "react";
import type { DiffTheme } from "./diff-themes.ts";

interface DiffWorkerPoolProps {
  theme: DiffTheme;
  children: ReactNode;
}

/** No web workers outside the web: the diff highlights on the main thread. */
export function DiffWorkerPool({ children }: DiffWorkerPoolProps): ReactNode {
  return children;
}
