import { useEffect, useState } from "react";

/** Leaving the page closes the socket, which is not a connection loss. */
export function useIsLeavingPage(): boolean {
  const [isLeaving, setIsLeaving] = useState(false);

  useEffect(() => {
    // react native has no page lifecycle events
    if (!("addEventListener" in globalThis)) return undefined;
    const handlePageHide = (): void => {
      setIsLeaving(true);
    };
    globalThis.addEventListener("pagehide", handlePageHide);
    return () => {
      globalThis.removeEventListener("pagehide", handlePageHide);
    };
  }, []);

  return isLeaving;
}
