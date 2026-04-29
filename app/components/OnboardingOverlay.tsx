"use client";

// Onboarding overlay — first-visit guided 5-frame sequence. Spec §3.1.
//
// Frames:
//   01 "front"   Front cover: title + tagline + tap to begin.
//   02 "guide"   Chrome dimmed, Fire+Wood highlighted, "Try." prompt.
//   03 (idle)    Inside "guide": gilt halo intensifies every 4s if no input.
//   04 "merging" Page desaturates while combine resolves.
//   05 "reveal"  Typewriter "Light pushed back at the dark." over the new tile.
//   "done"       Persist flag, fade overlay out.
//
// Bari fade-in / nod beats from the spec are deferred until painted Bari art
// lands; the existing emoji Bari is unaffected and stays visible.
//
// State transitions are driven by:
//   - tap on the front cover (front → guide)
//   - `game:combine-start` CustomEvent from main.ts (guide → merging)
//   - `game:combine-end`   CustomEvent from main.ts (merging → reveal)
//   - reveal-narrative timer + dwell (reveal → done)

import { useEffect, useRef, useState } from "react";
import { getTheme } from "../../src/theme";

const ONBOARDED_KEY = "idea-collector-onboarded";

const REVEAL_CHAR_MS = 55;
const REVEAL_DWELL_MS = 2200;

type Frame = "hidden" | "front" | "guide" | "merging" | "reveal" | "done";

export function OnboardingOverlay() {
  const [frame, setFrame] = useState<Frame>("hidden");
  const [revealChars, setRevealChars] = useState(0);
  const idleTickRef = useRef<number | null>(null);
  const lastInputRef = useRef<number>(Date.now());

  // First-visit detection.
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      if (!localStorage.getItem(ONBOARDED_KEY)) {
        setFrame("front");
      }
    } catch {
      // private mode etc. — skip onboarding silently.
    }
  }, []);

  // Mirror frame onto <html data-onboarding="..."> so skin.css can dim chrome.
  useEffect(() => {
    const root = document.documentElement;
    if (frame === "hidden") delete root.dataset.onboarding;
    else root.dataset.onboarding = frame;
    return () => { delete root.dataset.onboarding; };
  }, [frame]);

  // guide → merging on combine start
  useEffect(() => {
    if (frame !== "guide") return;
    const handler = () => setFrame("merging");
    document.addEventListener("game:combine-start", handler);
    return () => document.removeEventListener("game:combine-start", handler);
  }, [frame]);

  // merging → reveal on combine end
  useEffect(() => {
    if (frame !== "merging") return;
    const handler = () => setFrame("reveal");
    document.addEventListener("game:combine-end", handler);
    return () => document.removeEventListener("game:combine-end", handler);
  }, [frame]);

  // reveal: typewriter the spec narrative, dwell, then dismiss
  useEffect(() => {
    if (frame !== "reveal") return;
    setRevealChars(0);
    const narrative = getTheme().copy.onboarding.torchNarrative;
    let i = 0;
    const typer = window.setInterval(() => {
      i += 1;
      setRevealChars(i);
      if (i >= narrative.length) window.clearInterval(typer);
    }, REVEAL_CHAR_MS);
    const dismiss = window.setTimeout(
      () => setFrame("done"),
      narrative.length * REVEAL_CHAR_MS + REVEAL_DWELL_MS,
    );
    return () => {
      window.clearInterval(typer);
      window.clearTimeout(dismiss);
    };
  }, [frame]);

  // done: persist flag, fade out
  useEffect(() => {
    if (frame !== "done") return;
    try { localStorage.setItem(ONBOARDED_KEY, "true"); } catch {}
    const t = window.setTimeout(() => setFrame("hidden"), 700);
    return () => window.clearTimeout(t);
  }, [frame]);

  // Idle pulse during guide: every ~4s of no pointer activity, briefly
  // intensify the highlight on Fire/Wood by toggling a transient class on
  // <html>. CSS handles the animation; we just toggle the trigger.
  useEffect(() => {
    if (frame !== "guide") return;
    const root = document.documentElement;
    const onInput = () => { lastInputRef.current = Date.now(); };
    document.addEventListener("pointermove", onInput, { passive: true });
    document.addEventListener("pointerdown", onInput, { passive: true });
    idleTickRef.current = window.setInterval(() => {
      if (Date.now() - lastInputRef.current >= 3500) {
        root.dataset.onboardingHint = "pulse";
        window.setTimeout(() => { delete root.dataset.onboardingHint; }, 700);
        // Tell main.ts to show its directional arrow trail (Fire→workspace,
        // Wood→workspace, or workspace-Wood → workspace-Fire depending on
        // current state). The arrow self-fades a few seconds later.
        document.dispatchEvent(new CustomEvent("onboarding:idle-hint"));
      }
    }, 4000);
    return () => {
      document.removeEventListener("pointermove", onInput);
      document.removeEventListener("pointerdown", onInput);
      if (idleTickRef.current !== null) window.clearInterval(idleTickRef.current);
      delete root.dataset.onboardingHint;
    };
  }, [frame]);

  if (frame === "hidden") return null;

  const frontDismiss = () => { if (frame === "front") setFrame("guide"); };
  const onFrontKey = (e: React.KeyboardEvent) => {
    if (frame !== "front") return;
    if (e.key === "Enter" || e.key === " " || e.key === "Escape") {
      e.preventDefault();
      frontDismiss();
    }
  };

  const onboardingCopy = getTheme().copy.onboarding;

  return (
    <>
      {frame === "front" && (
        <div
          className="onboarding-overlay onboarding-overlay--front"
          onClick={frontDismiss}
          onKeyDown={onFrontKey}
          role="button"
          tabIndex={0}
          aria-label={onboardingCopy.tapToBegin}
        >
          <div className="onboarding-content">
            <div className="onboarding-ornament" aria-hidden="true">❦</div>
            <h1 className="onboarding-title">{onboardingCopy.title}</h1>
            <p className="onboarding-tagline">
              {onboardingCopy.tagline.split("\n").map((line, i) => (
                <span key={i}>{line}<br /></span>
              ))}
            </p>
            <p className="onboarding-cue">{onboardingCopy.tapToBegin}</p>
          </div>
        </div>
      )}

      {(frame === "guide" || frame === "merging" || frame === "reveal") && (
        <>
          <p className="onboarding-try" aria-hidden="true">{onboardingCopy.tryPrompt}</p>
          {frame === "reveal" && (
            <p className="onboarding-reveal" aria-live="polite">
              {onboardingCopy.torchNarrative.slice(0, revealChars)}
              <span className="onboarding-reveal-caret">|</span>
            </p>
          )}
        </>
      )}

      {frame === "done" && (
        <div className="onboarding-overlay onboarding-overlay--fading" aria-hidden="true">
          <div className="onboarding-content" />
        </div>
      )}
    </>
  );
}
