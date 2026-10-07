import { createHash } from 'node:crypto'

const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/**
 * Build one matcher per keyword. Matching is case-insensitive and anchored to
 * the start of a word so "deadline" also catches "deadlines" and "quote" also
 * catches "quoted"/"quotes", but "trusty" does not match "untrusty".
 */
export function compileKeywords(keywords) {
  const out = []
  for (const [priority, list] of Object.entries(keywords)) {
    for (const word of list) {
      const pattern = escapeRegExp(word.trim()).replace(/\s+/g, '\\s+')
      out.push({ word, priority, re: new RegExp(`(^|[^\\p{L}\\p{N}])${pattern}`, 'iu') })
    }
  }
  return out
}

export function matchKeywords(text, compiled) {
  const hits = []
  for (const k of compiled) {
    if (k.re.test(text)) hits.push({ word: k.word, priority: k.priority })
  }
  return hits
}

export function stableId(person, messageId) {
  return createHash('sha1').update(`${person}\u0000${messageId}`).digest('hex').slice(0, 16)
}

export function trimPreview(s, max = 160) {
  const clean = String(s || '').replace(/\s+/g, ' ').trim()
  return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean
}

/**
 * Turn raw Graph messages for one person into Focus Point items.
 * Only messages that hit at least one keyword are kept.
 */
export function buildFocusPoints(person, messages, config) {
  const compiled = compileKeywords(config.keywords)
  const items = []
  for (const m of messages) {
    const haystack = `${m.subject || ''}\n${m.bodyPreview || ''}`
    const hits = matchKeywords(haystack, compiled)
    if (hits.length === 0) continue
    const priority = hits.some((h) => h.priority === 'high') ? 'high' : 'normal'
    const from = m.from?.emailAddress || {}
    items.push({
      id: stableId(person, m.id),
      person,
      priority,
      keywords: [...new Set(hits.map((h) => h.word))],
      subject: trimPreview(m.subject || '(no subject)', 140),
      from: from.name || from.address || 'Unknown sender',
      received: m.receivedDateTime,
      link: m.webLink || null,
      ...(config.includePreview ? { preview: trimPreview(m.bodyPreview) } : {}),
    })
  }
  items.sort((a, b) => {
    if (a.priority !== b.priority) return a.priority === 'high' ? -1 : 1
    return String(b.received).localeCompare(String(a.received))
  })
  return items.slice(0, config.maxPerPerson || 12)
}

export function validateConfig(config) {
  if (!Array.isArray(config.people) || config.people.length === 0) {
    throw new Error('focus.config.json: people must be a non-empty array')
  }
  for (const p of config.people) {
    if (!p.name || !p.secret) throw new Error('focus.config.json: each person needs name and secret')
    if (!/^[A-Z][A-Z0-9_]*$/.test(p.secret)) {
      throw new Error(`focus.config.json: secret name "${p.secret}" must be UPPER_SNAKE_CASE`)
    }
  }
  const words = Object.values(config.keywords || {}).flat()
  if (words.length === 0) throw new Error('focus.config.json: keywords must contain at least one word')
  if (!Number.isInteger(config.lookbackDays) || config.lookbackDays < 1) {
    throw new Error('focus.config.json: lookbackDays must be a positive integer')
  }
  return true
}
