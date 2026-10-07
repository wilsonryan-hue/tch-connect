#!/usr/bin/env node
// Scans each configured person's Outlook inbox for Focus Point keywords and
// writes focus.json next to index.html. Runs in GitHub Actions on a schedule.
//
// Env:
//   FOCUS_CLIENT_ID        Entra app registration (public client) id
//   FOCUS_TOKEN_<NAME>     delegated refresh token per person (see focus-auth.mjs)
//   FOCUS_ROTATED_FILE     optional path; rotated refresh tokens are written here
//   FOCUS_GRAPH_BASE / FOCUS_LOGIN_BASE   test overrides for the Graph/login hosts
import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildFocusPoints, validateConfig } from './focus-lib.mjs'

const root = resolve(fileURLToPath(new URL('..', import.meta.url)))
const GRAPH = (process.env.FOCUS_GRAPH_BASE || 'https://graph.microsoft.com/v1.0').replace(/\/$/, '')
const LOGIN = (process.env.FOCUS_LOGIN_BASE || 'https://login.microsoftonline.com/common/oauth2/v2.0').replace(/\/$/, '')
const SCOPE = 'https://graph.microsoft.com/Mail.Read offline_access'

async function refreshAccessToken(clientId, refreshToken) {
  const body = new URLSearchParams({
    client_id: clientId,
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    scope: SCOPE,
  })
  const r = await fetch(`${LOGIN}/token`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body,
  })
  const j = await r.json().catch(() => ({}))
  if (!r.ok || !j.access_token) {
    throw new Error(`token refresh failed (${r.status}): ${j.error || 'unknown'} ${j.error_description || ''}`.trim())
  }
  return { accessToken: j.access_token, refreshToken: j.refresh_token || null }
}

async function fetchInbox(accessToken, sinceIso, maxPages = 4) {
  const params = new URLSearchParams({
    $filter: `receivedDateTime ge ${sinceIso}`,
    $orderby: 'receivedDateTime desc',
    $select: 'id,subject,bodyPreview,from,receivedDateTime,webLink',
    $top: '50',
  })
  let url = `${GRAPH}/me/mailFolders/inbox/messages?${params}`
  const messages = []
  for (let page = 0; url && page < maxPages; page++) {
    const r = await fetch(url, { headers: { authorization: `Bearer ${accessToken}` } })
    const j = await r.json().catch(() => ({}))
    if (!r.ok) {
      throw new Error(`Graph request failed (${r.status}): ${j.error?.code || ''} ${j.error?.message || ''}`.trim())
    }
    messages.push(...(j.value || []))
    url = j['@odata.nextLink'] || null
  }
  return messages
}

export async function scan({ config, env, now = new Date() }) {
  validateConfig(config)
  const clientId = env.FOCUS_CLIENT_ID
  const since = new Date(now.getTime() - config.lookbackDays * 86400000).toISOString()
  const people = []
  const rotated = {}

  for (const person of config.people) {
    const token = env[person.secret]
    if (!token) {
      people.push({ name: person.name, status: 'not-connected', items: [] })
      continue
    }
    if (!clientId) {
      people.push({ name: person.name, status: 'error', error: 'FOCUS_CLIENT_ID is not set', items: [] })
      continue
    }
    try {
      const auth = await refreshAccessToken(clientId, token)
      if (auth.refreshToken && auth.refreshToken !== token) rotated[person.secret] = auth.refreshToken
      const messages = await fetchInbox(auth.accessToken, since)
      people.push({
        name: person.name,
        status: 'ok',
        scanned: messages.length,
        items: buildFocusPoints(person.name, messages, config),
      })
    } catch (err) {
      people.push({ name: person.name, status: 'error', error: String(err.message || err), items: [] })
    }
  }

  return {
    result: {
      generated: now.toISOString(),
      lookbackDays: config.lookbackDays,
      keywords: Object.values(config.keywords).flat(),
      people,
    },
    rotated,
  }
}

async function main() {
  const config = JSON.parse(await readFile(resolve(root, 'focus.config.json'), 'utf8'))
  const { result, rotated } = await scan({ config, env: process.env })
  await writeFile(resolve(root, 'focus.json'), JSON.stringify(result, null, 2) + '\n')
  if (process.env.FOCUS_ROTATED_FILE && Object.keys(rotated).length > 0) {
    await writeFile(process.env.FOCUS_ROTATED_FILE, JSON.stringify(rotated))
  }
  for (const p of result.people) {
    const detail = p.status === 'ok' ? `${p.items.length} focus points from ${p.scanned} emails` : p.status
    console.log(`${p.name}: ${detail}${p.error ? ` — ${p.error}` : ''}`)
  }
  const failures = result.people.filter((p) => p.status === 'error')
  if (failures.length === config.people.length) {
    throw new Error('Focus scan failed for every person')
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error(err.message || err)
    process.exit(1)
  })
}
