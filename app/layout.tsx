import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Suspense } from "react";
import "./globals.css";
import { PostHogProvider } from "./posthog-provider";
import PostHogPageView from "./posthog-pageview";
import { AuthProvider } from "./components/auth-provider";

export const metadata: Metadata = {
  title: "Tiered 2D Breeder",
  description: "An AI-powered civilization breeding game.",
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
          <AuthProvider>
            {children}
          </AuthProvider>
        </PostHogProvider>
      </body>
    </html>
  );
}
