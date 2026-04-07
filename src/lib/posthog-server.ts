import { PostHog } from 'posthog-node'

// Per-request factory — never a module-level singleton.
// Vercel freezes execution context between requests; always call await ph.shutdown() before returning.
// Returns null when NEXT_PUBLIC_POSTHOG_KEY is not set (e.g. local dev).
export function getPostHogClient(): PostHog | null {
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY
  if (!key) {
    if (process.env.NODE_ENV === 'production') {
      console.error('[PostHog] NEXT_PUBLIC_POSTHOG_KEY is not set — tracking disabled')
    }
    return null
  }
  return new PostHog(key, {
    host: process.env.NEXT_PUBLIC_POSTHOG_HOST,
  })
}
