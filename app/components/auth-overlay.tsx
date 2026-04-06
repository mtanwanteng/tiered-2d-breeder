"use client";

import { useEffect, useState } from "react";
import { usePostHog } from "posthog-js/react";
import { authClient } from "../auth-client";
import { authStore, useAuthStore } from "../../src/store/auth";
import { AuthModal } from "./auth-modal";

export function AuthOverlay() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [fromVictory, setFromVictory] = useState(false);
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
    await authClient.signOut();
    posthog?.capture("auth_logout");
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
            <button className="auth-signout-btn" onClick={handleSignOut}>
              Sign out
            </button>
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
