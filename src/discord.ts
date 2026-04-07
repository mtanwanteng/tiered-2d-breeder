import { DiscordSDK } from '@discord/embedded-app-sdk'

export const isDiscordActivity = () =>
  typeof window !== 'undefined' &&
  window.location.hostname.endsWith('.discordsays.com')

let _sdk: DiscordSDK | null = null
export function getDiscordSdk(): DiscordSDK {
  if (!_sdk) _sdk = new DiscordSDK(process.env.NEXT_PUBLIC_DISCORD_CLIENT_ID!)
  return _sdk
}
