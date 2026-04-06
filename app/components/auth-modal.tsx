"use client";

import { useEffect } from "react";
import { usePostHog } from "posthog-js/react";
import { authClient } from "../auth-client";

interface AuthModalProps {
  isOpen: boolean;
  fromVictory?: boolean;
  onClose: () => void;
}

export function AuthModal({ isOpen, fromVictory, onClose }: AuthModalProps) {
  const posthog = usePostHog();

  useEffect(() => {
    if (isOpen) {
      posthog?.capture("auth_opened", { from_victory: fromVictory ?? false });
    }
  }, [isOpen, fromVictory, posthog]);

  if (!isOpen) return null;

  const handleSignIn = async (provider: "google" | "discord") => {
    await authClient.signIn.social({ provider, callbackURL: "/" });
  };

  return (
    <div className="auth-modal-backdrop" onClick={onClose}>
      <div className="auth-modal" onClick={(e) => e.stopPropagation()}>
        <button className="auth-modal-close" onClick={onClose} aria-label="Close">
          ×
        </button>
        <h2 className="auth-modal-title">
          {fromVictory ? "Save your achievements" : "Sign in"}
        </h2>
        {fromVictory && (
          <p className="auth-modal-subtitle">
            Link your run to an account to track your progress.
          </p>
        )}
        <div className="auth-modal-providers">
          <button
            className="auth-provider-btn auth-provider-google"
            onClick={() => handleSignIn("google")}
          >
            <GoogleIcon />
            Continue with Google
          </button>
          <button
            className="auth-provider-btn auth-provider-discord"
            onClick={() => handleSignIn("discord")}
          >
            <DiscordIcon />
            Continue with Discord
          </button>
        </div>
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M16.51 8H8.98v3h4.3c-.18 1-.74 1.48-1.6 2.04v2.01h2.6a7.8 7.8 0 0 0 2.38-5.88c0-.57-.05-.66-.15-1.18Z"
      />
      <path
        fill="#34A853"
        d="M8.98 17c2.16 0 3.97-.72 5.3-1.94l-2.6-2.04a4.8 4.8 0 0 1-7.18-2.54H1.83v2.07A8 8 0 0 0 8.98 17Z"
      />
      <path
        fill="#FBBC05"
        d="M4.5 10.52a4.8 4.8 0 0 1 0-3.04V5.41H1.83a8 8 0 0 0 0 7.18l2.67-2.07Z"
      />
      <path
        fill="#EA4335"
        d="M8.98 4.18c1.17 0 2.23.4 3.06 1.2l2.3-2.3A8 8 0 0 0 1.83 5.4L4.5 7.49a4.77 4.77 0 0 1 4.48-3.3Z"
      />
    </svg>
  );
}

function DiscordIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 127.14 96.36" aria-hidden="true">
      <path
        fill="#5865F2"
        d="M107.7 8.07A105.15 105.15 0 0 0 81.47 0a72.06 72.06 0 0 0-3.36 6.83 97.68 97.68 0 0 0-29.11 0A72.37 72.37 0 0 0 45.64 0a105.89 105.89 0 0 0-26.25 8.09C2.79 32.65-1.71 56.6.54 80.21a105.73 105.73 0 0 0 32.17 16.15 77.7 77.7 0 0 0 6.89-11.11 68.42 68.42 0 0 1-10.85-5.18c.91-.66 1.8-1.34 2.66-2a75.57 75.57 0 0 0 64.32 0c.87.71 1.76 1.39 2.66 2a68.68 68.68 0 0 1-10.87 5.19 77 77 0 0 0 6.89 11.1 105.25 105.25 0 0 0 32.19-16.14c2.64-27.38-4.51-51.11-18.9-72.15ZM42.45 65.69C36.18 65.69 31 60 31 53s5-12.74 11.43-12.74S54 46 53.89 53s-5.05 12.69-11.44 12.69Zm42.24 0C78.41 65.69 73.25 60 73.25 53s5-12.74 11.44-12.74S96.23 46 96.12 53s-5.04 12.69-11.43 12.69Z"
      />
    </svg>
  );
}
