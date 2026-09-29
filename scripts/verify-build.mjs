import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(fileURLToPath(new URL('..', import.meta.url)))
const index = await readFile(resolve(root, 'index.html'), 'utf8')
const live = JSON.parse(await readFile(resolve(root, 'live.json'), 'utf8'))

if (!index.includes('https://wilsonryan-hue.github.io/')) {
  throw new Error('index.html does not redirect to the TCH shop')
}
if (live.shop !== 'https://wilsonryan-hue.github.io/') {
  throw new Error('live.json shop target is incorrect')
}
console.log('Build verification passed: TCH redirect and shop target are valid.')