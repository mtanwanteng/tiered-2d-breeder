'use client'

import posthog from 'posthog-js'
import { PostHogProvider as PHProvider } from 'posthog-js/react'
import { useEffect } from 'react'

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_POSTHOG_KEY

    if (!key) {
      console.warn('[PostHog] NEXT_PUBLIC_POSTHOG_KEY is not set — tracking disabled')
      return
    }

    posthog.init(key, {
      api_host: '/ingest',
      defaults: '2026-01-30',
      person_profiles: 'identified_only',
      capture_pageview: false,
      capture_pageleave: true,
      debug: process.env.NODE_ENV === 'development',
      loaded: (ph) => {
        console.log(`[PostHog] Initialized ✓ distinct_id=${ph.get_distinct_id()}`)
      },
    })

    // Super-property attached to every event so this project's data is cleanly
    // separable from bari-playground's in the shared PostHog project.
    posthog.register({ app: 'breeder' })
  }, [])

  return <PHProvider client={posthog}>{children}</PHProvider>
}
