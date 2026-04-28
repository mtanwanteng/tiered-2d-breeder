"use client";

import { useEffect, useRef } from "react";
import { usePostHog } from "posthog-js/react";
import { AuthOverlay } from "./components/auth-overlay";
import { OnboardingOverlay } from "./components/OnboardingOverlay";

export default function GameClient({ selectFiveMode = false }: { selectFiveMode?: boolean } = {}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const posthog = usePostHog();

  useEffect(() => {
    let cleanup: undefined | (() => void);

    void import("../src/main").then(({ mountGame }) => {
      if (!containerRef.current) return;
      cleanup = mountGame(containerRef.current, selectFiveMode);
    });

    return () => {
      cleanup?.();
    };
  }, [selectFiveMode]);

  useEffect(() => {
    if (!posthog) return;
    void import("../src/identity").then(({ getOrCreateAnonId }) => {
      const anonId = getOrCreateAnonId();
      posthog.identify(anonId, { type: "anonymous" });
    });
  }, [posthog]);

  return (
    <div style={{ position: "relative" }}>
      <div id="app" ref={containerRef} />
      <AuthOverlay />
      {!selectFiveMode && <OnboardingOverlay />}
    </div>
  );
}
