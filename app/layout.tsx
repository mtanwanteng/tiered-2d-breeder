import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Suspense } from "react";
import { cookies } from "next/headers";
import "./globals.css";
import { PostHogProvider } from "./posthog-provider";
import PostHogPageView from "./posthog-pageview";
import { AuthProvider } from "./components/auth-provider";
import { DiscordActivityProvider } from "./components/discord-activity-provider";
import { THEMES, bibliophile } from "../src/theme";
import { getFontStylesheetUrl } from "../src/theme/fontStylesheet";

export const metadata: Metadata = {
  title: "Idea Collector",
  description: "Every idea is a story. Every story builds a civilization.",
  openGraph: {
    title: "Idea Collector",
    description: "Every idea is a story. Every story builds a civilization.",
    type: "website",
    siteName: "Idea Collector",
  },
  twitter: {
    card: "summary",
    title: "Idea Collector",
    description: "Every idea is a story. Every story builds a civilization.",
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  // Phase F: SSR first paint reads the player's theme cookie set by
  // src/settings.ts when they switch themes. Falls back to bibliophile for
  // first visits and rejects unknown values so a stale cookie can't poison
  // the render. Phase B's getTheme() runtime indirection still drives the
  // client-side dispatch; this just gets the right CSS scope on first paint.
  const cookieStore = await cookies();
  const cookieName = cookieStore.get("theme")?.value;
  const theme = (cookieName && THEMES[cookieName]) ? THEMES[cookieName] : bibliophile;
  return (
    <html lang="en" data-theme={theme.name}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link rel="stylesheet" href={getFontStylesheetUrl(theme)} />
      </head>
      <body>
        <PostHogProvider>
          <Suspense fallback={null}>
            <PostHogPageView />
          </Suspense>
          <DiscordActivityProvider />
          <AuthProvider>
            {children}
          </AuthProvider>
        </PostHogProvider>
      </body>
    </html>
  );
}
