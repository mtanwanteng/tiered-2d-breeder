"use client";

import { useEffect, useRef } from "react";
import { usePostHog } from "posthog-js/react";
import { authClient } from "../auth-client";
import { authStore } from "../../src/store/auth";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const session = authClient.useSession();
  const posthog = usePostHog();
  const prevUserId = useRef<string | null>(null);

  useEffect(() => {
    const user = session.data?.user ?? null;
    const userId = user?.id ?? null;

    if (userId && userId !== prevUserId.current) {
      // New login — identify in PostHog (merges anonymous history)
      const provider = (user as { provider?: string })?.provider ?? null;
      posthog?.identify(userId, {
        email: user?.email,
        name: user?.name,
        provider,
      });
      posthog?.capture("auth_completed", { provider });

      authStore.setState({
        isLoggedIn: true,
        userId,
        name: user?.name ?? null,
        avatarUrl: user?.image ?? null,
        provider: (provider as "google" | "discord") ?? null,
      });

      // Record anonId + lastActiveAt on first login (fire-and-forget)
      void import("../../src/identity").then(({ getOrCreateAnonId }) => {
        void fetch("/api/auth/record-activity", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ anonId: getOrCreateAnonId() }),
        });
      });
    }

    if (!userId && prevUserId.current) {
      // Signed out
      posthog?.capture("auth_logout");
      posthog?.reset();
      authStore.setState({
        isLoggedIn: false,
        userId: null,
        name: null,
        avatarUrl: null,
        provider: null,
      });
    }

    prevUserId.current = userId;
  }, [session.data, posthog]);

  return <>{children}</>;
}
