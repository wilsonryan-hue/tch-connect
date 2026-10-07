import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const root = resolve(fileURLToPath(new URL('..', import.meta.url)))
const index = await readFile(resolve(root, 'index.html'), 'utf8')
const shop = await readFile(resolve(root, 'shop.html'), 'utf8')
const live = JSON.parse(await readFile(resolve(root, 'live.json'), 'utf8'))
const mailbox = JSON.parse(await readFile(resolve(root, 'data/mailbox.json'), 'utf8'))

if (!index.includes('Focus Points')) {
  throw new Error('index.html is missing the Focus Points homepage')
}
if (!index.includes('https://wilsonryan-hue.github.io/')) {
  throw new Error('index.html does not link to the TCH shop')
}
if (!shop.includes('https://wilsonryan-hue.github.io/')) {
  throw new Error('shop.html does not redirect to the TCH shop')
}
if (live.shop !== 'https://wilsonryan-hue.github.io/') {
  throw new Error('live.json shop target is incorrect')
}
if (!Array.isArray(mailbox.messages) || mailbox.messages.length < 1) {
  throw new Error('mailbox scan is empty')
}

const focus = spawnSync(process.execPath, [resolve(root, 'scripts/verify-focus.mjs')], { stdio: 'inherit' })
if (focus.status !== 0) {
  throw new Error('Focus Points scan checks failed')
}

console.log('Build verification passed: Focus Points homepage, mailbox scan, and shop door are valid.')
