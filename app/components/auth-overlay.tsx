"use client";

import { useEffect, useRef, useState } from "react";
import { usePostHog } from "posthog-js/react";
import { authClient } from "../auth-client";
import { authStore, useAuthStore } from "../../src/store/auth";
import { isDiscordActivity } from "../../src/discord";
import { AuthModal } from "./auth-modal";

function DiscordIcon({ size = 15 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
      <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057.101 18.079.105 18.1.111 18.12a19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
    </svg>
  );
}

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
  const [accountOpen, setAccountOpen] = useState(false);
  const [confirmingSignOut, setConfirmingSignOut] = useState(false);
  const [htpOpen, setHtpOpen] = useState(false);
  const [videoOpen, setVideoOpen] = useState(false);
  const htpRef = useRef<HTMLDivElement>(null);
  const accountRef = useRef<HTMLDivElement>(null);
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn);
  const name = useAuthStore((s) => s.name);
  const avatarUrl = useAuthStore((s) => s.avatarUrl);
  const provider = useAuthStore((s) => s.provider);
  const posthog = usePostHog();

  // Close HTP popup when clicking outside
  useEffect(() => {
    if (!htpOpen) return;
    const handler = (e: MouseEvent) => {
      if (htpRef.current && !htpRef.current.contains(e.target as Node)) setHtpOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [htpOpen]);

  // Close account dropdown when clicking outside
  useEffect(() => {
    if (!accountOpen) return;
    const handler = (e: MouseEvent) => {
      if (accountRef.current && !accountRef.current.contains(e.target as Node)) {
        setAccountOpen(false);
        setConfirmingSignOut(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [accountOpen]);

  // Register callbacks in the store so vanilla TS (main.ts) can invoke them
  useEffect(() => {
    authStore.setState({
      openLogin: () => { setFromVictory(false); setIsModalOpen(true); },
      openLoginFromVictory: () => {
        posthog?.capture("auth_from_victory");
        setFromVictory(true);
        setIsModalOpen(true);
      },
      resetPlayer: async () => {
        if (authStore.getState().isLoggedIn) await authClient.signOut();
        authStore.getState().resetGame?.();
      },
    });
    return () => authStore.setState({ openLogin: null, openLoginFromVictory: null, resetPlayer: null });
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

  const initials = name ? name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 3) : "?";

  return (
    <>
      <div className="auth-overlay">
        {isLoggedIn ? (
          <div className="account-wrapper" ref={accountRef}>
            <button
              className={`auth-user-chip${accountOpen ? " auth-user-chip--open" : ""}`}
              onClick={() => { setAccountOpen((v) => !v); setConfirmingSignOut(false); }}
            >
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
              <span className="auth-user-name">{initials}</span>
            </button>

            {accountOpen && !isDiscordActivity() && (
              <div className="account-dropdown">
                <div className="account-dropdown-tail" />
                <div className="account-dropdown-name">{name}</div>
                {confirmingSignOut ? (
                  <>
                    <p className="account-signout-warning">Progress will be lost</p>
                    <button className="auth-signout-confirm-btn account-signout-confirm-btn" onClick={handleSignOut}>
                      End &amp; sign out
                    </button>
                    <button className="auth-signout-cancel-btn" onClick={() => setConfirmingSignOut(false)}>
                      Cancel
                    </button>
                  </>
                ) : (
                  <button className="account-signout-btn" onClick={() => setConfirmingSignOut(true)}>
                    Sign out
                  </button>
                )}
              </div>
            )}
          </div>
        ) : !isDiscordActivity() ? (
          <button className="auth-login-btn" onClick={openLogin}>
            Sign in
          </button>
        ) : null}

        {/* How to Play */}
        <div className="htp-wrapper" ref={htpRef}>
          <button
            className={`htp-btn${htpOpen ? " htp-btn--active" : ""}`}
            onClick={() => setHtpOpen((v) => !v)}
            aria-label="How to play"
          >
            How-To-Play{htpOpen && <span className="htp-btn-arrow"> ▲</span>}
          </button>

          {htpOpen && (
            <div className="htp-popup">
              <div className="htp-tail" />

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

              {!isDiscordActivity() && (
                <div className="htp-discord">
                  {provider === "discord" ? (
                    <a
                      href="https://discord.gg/jMdRx9ZjyC"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="htp-discord-icon-link"
                      title="Join our Discord server"
                    >
                      <DiscordIcon size={18} />
                    </a>
                  ) : (
                    <a
                      href="https://discord.gg/jMdRx9ZjyC"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="htp-discord-btn"
                    >
                      <DiscordIcon size={15} />
                      Join our Discord
                    </a>
                  )}
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
