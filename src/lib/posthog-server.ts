import { PostHog } from 'posthog-node'

// Per-request factory — never a module-level singleton.
// Vercel freezes execution context between requests; always call await ph.shutdown() before returning.
export function getPostHogClient(): PostHog {
  return new PostHog(process.env.NEXT_PUBLIC_POSTHOG_KEY!, {
    host: process.env.NEXT_PUBLIC_POSTHOG_HOST,
  })
}
