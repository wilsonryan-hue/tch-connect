import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { validateConfig } from './focus-lib.mjs'

const root = resolve(fileURLToPath(new URL('..', import.meta.url)))
const index = await readFile(resolve(root, 'index.html'), 'utf8')
const live = JSON.parse(await readFile(resolve(root, 'live.json'), 'utf8'))
const focusConfig = JSON.parse(await readFile(resolve(root, 'focus.config.json'), 'utf8'))

if (!index.includes('https://wilsonryan-hue.github.io/')) {
  throw new Error('index.html does not link to the TCH shop')
}
if (!index.includes('id="focus"')) {
  throw new Error('index.html is missing the Focus Points section')
}
if (live.shop !== 'https://wilsonryan-hue.github.io/') {
  throw new Error('live.json shop target is incorrect')
}
validateConfig(focusConfig)
console.log('Build verification passed: shop link, Focus Points section and focus.config.json are valid.')
