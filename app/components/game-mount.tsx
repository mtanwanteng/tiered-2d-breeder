"use client";

import { useEffect, useRef } from "react";
import { usePostHog } from "posthog-js/react";
import { AuthOverlay } from "./auth-overlay";

type MountGameModule = {
  mountGame: (app: HTMLElement) => void | (() => void);
};

export function GameMount({
  loadModule,
  shellClassName,
  decorate,
}: {
  loadModule: () => Promise<MountGameModule>;
  shellClassName?: string;
  decorate?: (root: HTMLDivElement) => void;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const shellRef = useRef<HTMLDivElement | null>(null);
  const posthog = usePostHog();

  useEffect(() => {
    let cleanup: undefined | (() => void);

    void loadModule().then(({ mountGame }) => {
      if (!containerRef.current) return;
      cleanup = mountGame(containerRef.current) ?? undefined;
      if (shellRef.current && decorate) {
        decorate(shellRef.current);
      }
    });

    return () => {
      cleanup?.();
    };
  }, [decorate, loadModule]);

  useEffect(() => {
    if (!posthog) return;
    void import("../../src/identity").then(({ getOrCreateAnonId }) => {
      const anonId = getOrCreateAnonId();
      posthog.identify(anonId, { type: "anonymous" });
    });
  }, [posthog]);

  return (
    <div className={shellClassName} ref={shellRef} style={{ position: "relative" }}>
      <div id="app" ref={containerRef} />
      <AuthOverlay />
    </div>
  );
}
