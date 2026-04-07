"use client";

import { useEffect, useState } from "react";
import { usePostHog } from "posthog-js/react";
import { authClient } from "../auth-client";
import { authStore, useAuthStore } from "../../src/store/auth";
import { isDiscordActivity } from "../../src/discord";
import { AuthModal } from "./auth-modal";

export function AuthOverlay() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [fromVictory, setFromVictory] = useState(false);
  const [confirmingSignOut, setConfirmingSignOut] = useState(false);
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn);
  const name = useAuthStore((s) => s.name);
  const avatarUrl = useAuthStore((s) => s.avatarUrl);
  const posthog = usePostHog();

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
    });

    return () => {
      authStore.setState({ openLogin: null, openLoginFromVictory: null });
    };
  }, [posthog]);

  const handleSignOut = async () => {
    posthog?.capture("auth_logout");
    await authClient.signOut();
    authStore.getState().resetGame?.();
  };

  return (
    <>
      <div className="auth-overlay">
        {isLoggedIn ? (
          <div className="auth-user-chip">
            {avatarUrl && (
              <img src={avatarUrl} alt={name ?? "User"} className="auth-avatar" />
            )}
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
        ) : (
          <button
            className="auth-login-btn"
            onClick={() => {
              setFromVictory(false);
              setIsModalOpen(true);
            }}
          >
            Sign in
          </button>
        )}
      </div>
      <AuthModal
        isOpen={isModalOpen}
        fromVictory={fromVictory}
        onClose={() => setIsModalOpen(false)}
      />
    </>
  );
}
