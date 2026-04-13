import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Suspense } from "react";
import "./globals.css";
import { PostHogProvider } from "./posthog-provider";
import PostHogPageView from "./posthog-pageview";
import { AuthProvider } from "./components/auth-provider";
import { DiscordActivityProvider } from "./components/discord-activity-provider";

export const metadata: Metadata = {
  title: "Bari The Architect",
  description: "A Civilization Creation Game using AI to inspire Creativity",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="en">
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
