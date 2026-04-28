import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Suspense } from "react";
import "./globals.css";
import { PostHogProvider } from "./posthog-provider";
import PostHogPageView from "./posthog-pageview";
import { AuthProvider } from "./components/auth-provider";
import { DiscordActivityProvider } from "./components/discord-activity-provider";

export const metadata: Metadata = {
  title: "Idea Collector",
  description: "Every idea is a story. Every story builds a civilization.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="en" data-theme="bibliophile">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Cardo:ital@0;1&family=Inter:wght@400;500&display=swap"
        />
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
