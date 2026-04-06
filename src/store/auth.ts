import { createStore } from "zustand/vanilla";
import { subscribeWithSelector } from "zustand/middleware";
import { useStore } from "zustand";

export interface AuthState {
  isLoggedIn: boolean;
  userId: string | null;
  name: string | null;
  avatarUrl: string | null;
  provider: "google" | "discord" | null;
  openLogin: (() => void) | null;
  openLoginFromVictory: (() => void) | null;
  resetGame: (() => void) | null;
}

export const authStore = createStore<AuthState>()(
  subscribeWithSelector(
    (): AuthState => ({
      isLoggedIn: false,
      userId: null,
      name: null,
      avatarUrl: null,
      provider: null,
      openLogin: null,
      openLoginFromVictory: null,
      resetGame: null,
    })
  )
);

// React hook — use in components
export function useAuthStore<T>(selector: (s: AuthState) => T): T {
  return useStore(authStore, selector);
}
