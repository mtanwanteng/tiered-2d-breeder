export async function POST(req: Request) {
  const { code } = (await req.json()) as { code: string }
  const res = await fetch('https://discord.com/api/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.DISCORD_CLIENT_ID!,
      client_secret: process.env.DISCORD_CLIENT_SECRET!,
      grant_type: 'authorization_code',
      code,
    }),
  })
  const data = (await res.json()) as { access_token: string }
  return Response.json({ access_token: data.access_token })
}
