import { WorkerPoolContextProvider, useWorkerPool } from "@pierre/diffs/react";
import type { ReactNode } from "react";
import { useEffect } from "react";
import type { DiffTheme } from "./diff-themes.ts";
import { diffThemeNames } from "./diff-themes.ts";

const createDiffWorker = (): Worker =>
  new Worker(new URL("./diff-worker.ts", import.meta.url));

interface SyncPoolThemeProps {
  theme: DiffTheme;
}

function SyncPoolTheme({ theme }: SyncPoolThemeProps): null {
  const pool = useWorkerPool();
  useEffect(() => {
    pool
      ?.setRenderOptions({ theme: diffThemeNames(theme) })
      .catch((error: unknown) => {
        console.error("diff worker pool: theme not applied", error);
      });
  }, [pool, theme]);
  return null;
}

interface DiffWorkerPoolProps {
  theme: DiffTheme;
  children: ReactNode;
}

/**
 * Moves shiki highlighting off the main thread, where a large diff froze the
 * page. Metro bundles the worker itself: it rewrites a literal
 * `new Worker(new URL(specifier, import.meta.url))` into a split bundle, so
 * the specifier must stay a string literal in this call.
 *
 * The pool is a module singleton created from the first render's props, and
 * its theme wins over the one a `FileDiff` is given: a theme picked while a
 * diff is open has to be pushed to it. Each file still passes its own theme,
 * which applies if the workers fail and highlighting falls back to the main
 * thread. The last provider to unmount terminates the pool.
 */
export function DiffWorkerPool({
  theme,
  children,
}: DiffWorkerPoolProps): ReactNode {
  return (
    <WorkerPoolContextProvider
      poolOptions={{ workerFactory: createDiffWorker }}
      highlighterOptions={{ theme: diffThemeNames(theme) }}
    >
      <SyncPoolTheme theme={theme} />
      {children}
    </WorkerPoolContextProvider>
  );
}
