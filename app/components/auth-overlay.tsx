"use client";

import { useEffect, useRef, useState } from "react";
import { usePostHog } from "posthog-js/react";
import { authClient } from "../auth-client";
import { authStore, useAuthStore } from "../../src/store/auth";
import { isDiscordActivity } from "../../src/discord";
import { AuthModal } from "./auth-modal";

function VideoModal({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div className="htp-video-backdrop" onClick={onClose}>
      <div className="htp-video-modal" onClick={(e) => e.stopPropagation()}>
        <button className="htp-video-close" onClick={onClose}>&times;</button>
        <video
          className="htp-video-player"
          src="/how-to-play.mp4"
          autoPlay
          loop
          playsInline
          muted
        />
      </div>
    </div>
  );
}

export function AuthOverlay() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [fromVictory, setFromVictory] = useState(false);
  const [confirmingSignOut, setConfirmingSignOut] = useState(false);
  const [htpOpen, setHtpOpen] = useState(false);
  const [videoOpen, setVideoOpen] = useState(false);
  const htpRef = useRef<HTMLDivElement>(null);
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn);
  const name = useAuthStore((s) => s.name);
  const avatarUrl = useAuthStore((s) => s.avatarUrl);
  const posthog = usePostHog();

  // Close HTP popup when clicking outside
  useEffect(() => {
    if (!htpOpen) return;
    const handler = (e: MouseEvent) => {
      if (htpRef.current && !htpRef.current.contains(e.target as Node)) {
        setHtpOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [htpOpen]);

  // Register callbacks in the store so vanilla TS (main.ts) can invoke them
  useEffect(() => {
    authStore.setState({
      openLogin: () => {
        setFromVictory(false);
        setIsModalOpen(true);
      },
      openLoginFromVictory: () => {
        posthog?.capture("auth_from_victory");
        setFromVictory(true);
        setIsModalOpen(true);
      },
      resetPlayer: async () => {
        if (authStore.getState().isLoggedIn) {
          await authClient.signOut();
        }
        authStore.getState().resetGame?.();
      },
    });

    return () => {
      authStore.setState({ openLogin: null, openLoginFromVictory: null, resetPlayer: null });
    };
  }, [posthog]);

  const handleSignOut = async () => {
    posthog?.capture("auth_logout");
    await authClient.signOut();
    authStore.getState().resetGame?.();
  };

  const openLogin = () => {
    setFromVictory(false);
    setIsModalOpen(true);
    setHtpOpen(false);
  };

  return (
    <>
      <div className="auth-overlay">
        {isLoggedIn ? (
          <div className="auth-user-chip">
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt={name ?? "User"}
                className="auth-avatar"
                onError={(e) => {
                  e.currentTarget.style.display = "none";
                  const placeholder = e.currentTarget.nextElementSibling as HTMLElement | null;
                  if (placeholder?.classList.contains("auth-avatar-placeholder")) placeholder.style.display = "flex";
                }}
              />
            ) : null}
            <span className="auth-avatar-placeholder" style={{ display: avatarUrl ? "none" : "flex" }}>
              {(name ?? "?")[0].toUpperCase()}
            </span>
            <span className="auth-user-name">{name}</span>
            {!isDiscordActivity() && (confirmingSignOut ? (
              <div className="auth-signout-confirm">
                <span className="auth-signout-warning">Progress will be lost</span>
                <button className="auth-signout-confirm-btn" onClick={handleSignOut}>
                  End &amp; sign out
                </button>
                <button className="auth-signout-cancel-btn" onClick={() => setConfirmingSignOut(false)}>
                  Cancel
                </button>
              </div>
            ) : (
              <button className="auth-signout-btn" onClick={() => setConfirmingSignOut(true)}>
                Sign out
              </button>
            ))}
          </div>
        ) : !isDiscordActivity() ? (
          <button className="auth-login-btn" onClick={openLogin}>
            Sign in
          </button>
        ) : null}

        {/* How to Play */}
        <div className="htp-wrapper" ref={htpRef}>
          <button
            className="htp-btn"
            onClick={() => setHtpOpen((v) => !v)}
            aria-label="How to play"
          >
            How-To-Play
          </button>

          {htpOpen && (
            <div className="htp-popup">
              <div className="htp-tail" />
              <h3 className="htp-title">How to Play</h3>

              <button className="htp-play-btn" onClick={() => setVideoOpen(true)}>
                ▶ Play Video
              </button>

              <ol className="htp-steps">
                <li>Drag two tiles together to <strong>combine</strong> them into something new.</li>
                <li>Discover new <strong>ideas</strong> and build up your civilization.</li>
                <li>Complete era goals to <strong>advance through history</strong>.</li>
                <li>Reach the <strong>Age of Plenty</strong> to win.</li>
              </ol>

              {!isLoggedIn && !isDiscordActivity() && (
                <div className="htp-cta">
                  <p className="htp-cta-text">
                    <strong>Sign in</strong> to save your civilization and share your journey with friends.
                  </p>
                  <button className="htp-cta-btn" onClick={openLogin}>
                    Sign in to save &amp; share
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {videoOpen && <VideoModal onClose={() => setVideoOpen(false)} />}

      <AuthModal
        isOpen={isModalOpen}
        fromVictory={fromVictory}
        onClose={() => setIsModalOpen(false)}
      />
    </>
  );
}
