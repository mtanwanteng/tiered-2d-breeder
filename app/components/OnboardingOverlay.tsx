"use client";

// Onboarding overlay — first-visit welcome. Spec §3.1.
//
// Phase 5 minimum: a parchment "front cover" with title + tagline + tap-to-
// begin. The full 5-frame guided sequence (Bari + ink-bloom Fire+Wood + "Try."
// + scratch-in narrative) is a Phase 8 polish item once Bari art is in place.
//
// Detection: first visit if no `idea-collector-onboarded` flag in localStorage.
// On dismiss, also sets the legacy `htp_viewed` flag so the older How-To-Play
// modal (auth-overlay.tsx) doesn't fire on top of an already-onboarded player.

import { useEffect, useState } from "react";

const ONBOARDED_KEY = "idea-collector-onboarded";
const HTP_VIEWED_KEY = "htp_viewed";
const HTP_VIEWED_KEY_S5 = "htp_viewed_s5";

export function OnboardingOverlay() {
  const [open, setOpen] = useState(false);
  const [fading, setFading] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const onboarded = localStorage.getItem(ONBOARDED_KEY);
      if (!onboarded) {
        setOpen(true);
        // Suppress legacy HTP auto-open — onboarding subsumes it.
        localStorage.setItem(HTP_VIEWED_KEY, "true");
        localStorage.setItem(HTP_VIEWED_KEY_S5, "true");
      }
    } catch {
      // localStorage unavailable (private mode etc.) — skip onboarding.
    }
  }, []);

  if (!open) return null;

  const dismiss = () => {
    if (fading) return;
    setFading(true);
    try { localStorage.setItem(ONBOARDED_KEY, "true"); } catch {}
    setTimeout(() => setOpen(false), 600);
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " " || e.key === "Escape") {
      e.preventDefault();
      dismiss();
    }
  };

  return (
    <div
      className={`onboarding-overlay${fading ? " onboarding-overlay--fading" : ""}`}
      onClick={dismiss}
      onKeyDown={onKey}
      role="button"
      tabIndex={0}
      aria-label="Tap to begin"
    >
      <div className="onboarding-content">
        <div className="onboarding-ornament" aria-hidden="true">❦</div>
        <h1 className="onboarding-title">Idea Collector</h1>
        <p className="onboarding-tagline">
          Every idea is a story.<br />
          Every story builds a civilization.
        </p>
        <p className="onboarding-cue">tap to begin</p>
      </div>
    </div>
  );
}
