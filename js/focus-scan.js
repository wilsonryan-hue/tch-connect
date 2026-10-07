/**
 * Scan staff mail for Focus Points.
 * Matches the requested keywords (and close construction-desk variants)
 * then assigns a tickable task to each of Ryan, Kacey, Alex, and Jim
 * who appear on the thread.
 */

export const KEYWORDS = [
  { id: 'deadline', label: 'deadline', pattern: /\bdeadlines?\b/i },
  { id: 'new-business', label: 'new business', pattern: /\bnew business\b/i },
  { id: 'trusty', label: 'trusty', pattern: /\btrusty\b/i },
  { id: 'quote', label: 'quote', pattern: /\bquotes?\b|\bquotation\b|\bproposal\b/i },
  { id: 'new-work', label: 'new work', pattern: /\bnew works?\b|\bnew .{0,28} leads\b/i },
  { id: 'urgent', label: 'urgent', pattern: /\burgent(?:ly)?\b|\basap\b/i },
]

export const PEOPLE = [
  {
    id: 'ryan',
    name: 'Ryan',
    emails: ['wilson.ryan@live.com', 'ryan@treunroc.com'],
  },
  {
    id: 'kacey',
    name: 'Kacey',
    emails: ['kacey@treunroc.com', 'kacey@balmoralcontractsltd.co.uk'],
  },
  {
    id: 'alex',
    name: 'Alex',
    emails: ['alex@treunroc.com'],
  },
  {
    id: 'jim',
    name: 'Jim',
    emails: ['jim@treunroc.com'],
  },
]

function normEmail(value) {
  return String(value || '').trim().toLowerCase()
}

function unique(list) {
  return [...new Set(list)]
}

function haystack(message) {
  const fromName = message.from?.name || ''
  const fromAddress = message.from?.address || ''
  return [
    message.subject || '',
    message.snippet || '',
    fromName,
    fromAddress,
  ].join('\n')
}

export function matchKeywords(text) {
  const hay = String(text || '')
  return KEYWORDS.filter((keyword) => keyword.pattern.test(hay)).map((keyword) => keyword.label)
}

function addressesOnMessage(message) {
  const collected = [
    message.from?.address,
    ...(message.to || []),
    ...(message.cc || []),
  ]
  return unique(collected.map(normEmail).filter(Boolean))
}

export function peopleOnMessage(message) {
  const addresses = addressesOnMessage(message)
  return PEOPLE.filter((person) => person.emails.some((email) => addresses.includes(normEmail(email))))
}

function taskTitle(message, keywords) {
  const subject = String(message.subject || '').trim() || 'Untitled mail'
  const lead = keywords[0] || 'focus'
  return `${lead}: ${subject}`
}

/**
 * @param {Array<object>} messages
 * @param {{ doneIds?: string[] }} [options]
 */
export function scanMailbox(messages, options = {}) {
  const done = new Set((options.doneIds || []).map(String))
  const tasks = []

  for (const message of messages || []) {
    const keywords = unique(matchKeywords(haystack(message)))
    if (!keywords.length) continue
    const people = peopleOnMessage(message)
    if (!people.length) continue

    for (const person of people) {
      const id = `${person.id}:${message.id}`
      if (done.has(id)) continue
      tasks.push({
        id,
        personId: person.id,
        personName: person.name,
        messageId: message.id,
        title: taskTitle(message, keywords),
        subject: String(message.subject || '').trim() || 'Untitled mail',
        snippet: String(message.snippet || '').trim(),
        from: message.from?.name || message.from?.address || 'Unknown',
        received: message.received || '',
        keywords,
      })
    }
  }

  tasks.sort((a, b) => String(b.received).localeCompare(String(a.received)))
  return tasks
}

export function tasksByPerson(tasks) {
  const grouped = {}
  for (const person of PEOPLE) grouped[person.id] = []
  for (const task of tasks) {
    if (!grouped[task.personId]) grouped[task.personId] = []
    grouped[task.personId].push(task)
  }
  return grouped
}
