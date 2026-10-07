#!/usr/bin/env node
// One-time sign-in helper. Run locally once per person:
//   FOCUS_CLIENT_ID=<app id> node scripts/focus-auth.mjs
// Sign in as that person when prompted, then paste the printed refresh token
// into the matching GitHub Actions secret (FOCUS_TOKEN_RYAN, FOCUS_TOKEN_KACEY, ...).
// Works for personal Microsoft accounts (outlook.com / live.com) and work accounts.
import { setTimeout as sleep } from 'node:timers/promises'

const LOGIN = 'https://login.microsoftonline.com/common/oauth2/v2.0'
const SCOPE = 'https://graph.microsoft.com/Mail.Read https://graph.microsoft.com/User.Read offline_access'

const clientId = process.env.FOCUS_CLIENT_ID
if (!clientId) {
  console.error('Set FOCUS_CLIENT_ID to the Entra app registration (application/client) id.')
  process.exit(1)
}

const form = (o) => new URLSearchParams(o)
const post = async (path, body) => {
  const r = await fetch(`${LOGIN}/${path}`, { method: 'POST', body: form(body) })
  return { ok: r.ok, json: await r.json().catch(() => ({})) }
}

const start = await post('devicecode', { client_id: clientId, scope: SCOPE })
if (!start.ok) {
  console.error('Could not start sign-in:', start.json.error_description || start.json.error)
  process.exit(1)
}
console.log(`\n${start.json.message}\n`)

const interval = (start.json.interval || 5) * 1000
const deadline = Date.now() + (start.json.expires_in || 900) * 1000
while (Date.now() < deadline) {
  await sleep(interval)
  const poll = await post('token', {
    client_id: clientId,
    grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
    device_code: start.json.device_code,
  })
  if (poll.ok) {
    const me = await fetch('https://graph.microsoft.com/v1.0/me', {
      headers: { authorization: `Bearer ${poll.json.access_token}` },
    }).then((r) => r.json()).catch(() => ({}))
    console.log(`Signed in as ${me.displayName || '?'} <${me.mail || me.userPrincipalName || '?'}>`)
    console.log('\nRefresh token (store as the FOCUS_TOKEN_<NAME> secret, never commit it):\n')
    console.log(poll.json.refresh_token)
    process.exit(0)
  }
  if (poll.json.error === 'authorization_pending' || poll.json.error === 'slow_down') continue
  console.error('Sign-in failed:', poll.json.error_description || poll.json.error)
  process.exit(1)
}
console.error('Sign-in timed out. Run the command again.')
process.exit(1)
