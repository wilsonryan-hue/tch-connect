import { matchKeywords, peopleOnMessage, scanMailbox, tasksByPerson } from '../js/focus-scan.js'

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

const quoteMail = {
  id: 'office-quote',
  subject: 'Re: Office Quote',
  snippet: 'Hi mate. seems ok',
  from: { name: 'Kacey Lindsay', address: 'kacey@treunroc.com' },
  to: ['wilson.ryan@live.com'],
  cc: [],
  received: '2025-07-29T09:43:46Z',
}

const packageMail = {
  id: 'golf-package',
  subject: 'Golf Course Clubhouse D&B Package',
  snippet: 'Please send a proposal for the design package.',
  from: { name: 'Kacey Lindsay', address: 'kacey@treunroc.com' },
  to: ['greg.martin@smithbrewer.co.uk'],
  cc: ['alex@treunroc.com', 'wilson.ryan@live.com', 'jim@treunroc.com'],
  received: '2026-08-24T19:25:55Z',
}

const noise = {
  id: 'amazon',
  subject: 'Prime Big Deal Days ends at midnight',
  snippet: 'Last chance to save big.',
  from: { name: 'Amazon.co.uk', address: 'amazon-offers@amazon.co.uk' },
  to: ['wilson.ryan@live.com'],
  cc: [],
  received: '2026-10-07T00:45:16Z',
}

const trustyUrgent = {
  id: 'trusty-job',
  subject: 'Urgent Trusty quote needed',
  snippet: 'New work on the Trusty site. Deadline Friday.',
  from: { name: 'Jim Lindsay', address: 'jim@treunroc.com' },
  to: ['ryan@treunroc.com', 'kacey@treunroc.com', 'alex@treunroc.com'],
  cc: [],
  received: '2026-10-01T09:00:00Z',
}

assert(matchKeywords(quoteMail.subject).includes('quote'), 'quote keyword should match Office Quote')
assert(matchKeywords(packageMail.snippet).includes('quote'), 'proposal should count as quote')
assert(matchKeywords(noise.subject + noise.snippet).length === 0, 'marketing mail should not match')

const hits = matchKeywords(`${trustyUrgent.subject} ${trustyUrgent.snippet}`)
for (const word of ['deadline', 'trusty', 'quote', 'new work', 'urgent']) {
  assert(hits.includes(word), `expected keyword ${word}`)
}

assert(peopleOnMessage(packageMail).map((row) => row.id).join(',') === 'ryan,kacey,alex,jim', 'package mail belongs to all four')
assert(peopleOnMessage(quoteMail).map((row) => row.id).join(',') === 'ryan,kacey', 'office quote is Ryan and Kacey')
assert(peopleOnMessage(noise).map((row) => row.id).join(',') === 'ryan', 'Ryan still appears on his own inbox noise')

const open = scanMailbox([quoteMail, packageMail, noise, trustyUrgent])
assert(open.every((task) => task.personId !== 'ryan' || task.messageId !== 'amazon'), 'Amazon must not become a focus point')
assert(open.some((task) => task.personId === 'alex' && task.messageId === 'golf-package'), 'Alex gets the D&B package')
assert(open.some((task) => task.personId === 'jim' && task.messageId === 'golf-package'), 'Jim gets the D&B package')
assert(open.some((task) => task.personId === 'kacey' && task.messageId === 'office-quote'), 'Kacey gets the office quote')

const afterTick = scanMailbox([quoteMail, packageMail], { doneIds: ['kacey:office-quote'] })
assert(!afterTick.some((task) => task.id === 'kacey:office-quote'), 'ticked tasks are removed from the list')
assert(afterTick.some((task) => task.id === 'ryan:office-quote'), 'ticking Kacey does not clear Ryan')

const grouped = tasksByPerson(open)
assert(grouped.ryan.length > 0, 'Ryan column has tasks')
assert(grouped.kacey.length > 0, 'Kacey column has tasks')
assert(grouped.alex.length > 0, 'Alex column has tasks')
assert(grouped.jim.length > 0, 'Jim column has tasks')

console.log('Focus Points scan checks passed.')
