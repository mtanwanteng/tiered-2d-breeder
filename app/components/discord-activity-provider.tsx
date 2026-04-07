'use client'

import { useEffect } from 'react'
import posthog from 'posthog-js'
import { getDiscordSdk, isDiscordActivity } from '../../src/discord'
import { authStore } from '../../src/store/auth'

export function DiscordActivityProvider() {
  useEffect(() => {
    let cancelled = false

    if (!isDiscordActivity()) return

    async function init() {
      const sdk = getDiscordSdk()
      await sdk.ready()
      if (cancelled) return

      const { code } = await sdk.commands.authorize({
        client_id: process.env.NEXT_PUBLIC_DISCORD_CLIENT_ID!,
        response_type: 'code',
        state: '',
        prompt: 'none',
        scope: ['identify'],
      })
      if (cancelled) return

      const res = await fetch('/api/discord/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      })
      const { access_token } = (await res.json()) as { access_token: string }
      if (cancelled) return

      const auth = await sdk.commands.authenticate({ access_token })
      if (cancelled) return

      const user = auth.user
      authStore.setState({
        isLoggedIn: true,
        userId: user.id,
        name: user.username,
        avatarUrl: user.avatar
          ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png`
          : null,
        provider: 'discord',
      })

      posthog.identify(user.id, { discord_username: user.username })
    }

    init().catch((err) => console.error('[Discord] Activity init failed:', err))

    return () => {
      cancelled = true
    }
  }, [])

  return null
}
