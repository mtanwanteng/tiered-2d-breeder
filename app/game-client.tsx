"use client";

import { useEffect, useRef } from "react";

export default function GameClient() {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let cleanup: undefined | (() => void);

    void import("../src/main").then(({ mountGame }) => {
      if (!containerRef.current) {
        return;
      }

      cleanup = mountGame(containerRef.current);
    });

    return () => {
      cleanup?.();
    };
  }, []);

  return <div id="app" ref={containerRef} />;
}
