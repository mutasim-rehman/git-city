"use client";

import { useEffect, useState, type ReactNode } from "react";

/** Mount children after the main scene is interactive — avoids blocking first paint. */
export function DeferredMount({
  children,
  timeoutMs = 1500,
}: {
  children: ReactNode;
  timeoutMs?: number;
}) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const schedule =
      typeof window.requestIdleCallback === "function"
        ? (cb: () => void) =>
            window.requestIdleCallback(cb, { timeout: timeoutMs })
        : (cb: () => void) => window.setTimeout(cb, 16);
    const cancel =
      typeof window.cancelIdleCallback === "function"
        ? window.cancelIdleCallback
        : window.clearTimeout;

    const id = schedule(() => setReady(true));
    return () => cancel(id);
  }, [timeoutMs]);

  return ready ? children : null;
}
