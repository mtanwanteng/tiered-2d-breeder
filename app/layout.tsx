import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Suspense } from "react";
import "./globals.css";
import { PostHogProvider } from "./posthog-provider";
import PostHogPageView from "./posthog-pageview";
import { AuthProvider } from "./components/auth-provider";
import { DiscordActivityProvider } from "./components/discord-activity-provider";
import { getTheme } from "../src/theme";
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

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  // SSR first paint resolves the active theme synchronously. Phase F adds
  // a cookie / user-preference read in front of this so non-default themes
  // also avoid the FOUC; Phase B locks in the indirection.
  const theme = getTheme();
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
