import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "../src/db";
import { DEFAULT_THEME_NAME, THEMES } from "../src/theme";

// Pull the player's `theme` cookie out of the OAuth callback request so a
// brand-new user row can be seeded with the theme they were already viewing
// (set by src/settings.ts whenever they pick one in the Appearance picker
// or land on the SSR fallback). Falls back to DEFAULT_THEME_NAME — the
// app-wide default — when no cookie is present or the value isn't a
// registered theme name.
function readThemeFromCookieHeader(cookieHeader: string | null | undefined): string {
  if (!cookieHeader) return DEFAULT_THEME_NAME;
  const match = cookieHeader.match(/(?:^|;\s*)theme=([^;]+)/);
  if (!match) return DEFAULT_THEME_NAME;
  const decoded = decodeURIComponent(match[1]);
  return THEMES[decoded] ? decoded : DEFAULT_THEME_NAME;
}

export const auth = betterAuth({
  baseURL: process.env.BETTER_AUTH_URL,
  database: drizzleAdapter(db, { provider: "pg" }),
  session: {
    cookieCache: { enabled: true, maxAge: 60 * 5 },
  },
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    },
    discord: {
      clientId: process.env.DISCORD_CLIENT_ID!,
      clientSecret: process.env.DISCORD_CLIENT_SECRET!,
    },
  },
  // Apply the client-side default theme to brand-new user rows. The DB
  // column's stored .default("bibliophile") in src/db/schema.ts is the
  // historical migration value; without this hook every new player would
  // be created as Bibliophile regardless of what their browser was
  // showing.
  databaseHooks: {
    user: {
      create: {
        before: async (newUser, ctx) => {
          const cookieHeader = ctx?.request?.headers.get("cookie");
          const themePreference = readThemeFromCookieHeader(cookieHeader);
          return { data: { ...newUser, themePreference } };
        },
      },
    },
  },
});
