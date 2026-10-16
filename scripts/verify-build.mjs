import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const shop = 'https://www.tchworks.co.uk/'
const root = resolve(fileURLToPath(new URL('..', import.meta.url)))
const index = await readFile(resolve(root, 'index.html'), 'utf8')
const live = JSON.parse(await readFile(resolve(root, 'live.json'), 'utf8'))

const required = [
  `content="0;url=${shop}"`,
  `rel="canonical" href="${shop}"`,
  `href="${shop}"`,
  'name="robots" content="noindex,nofollow"',
]

for (const snippet of required) {
  if (!index.includes(snippet)) {
    throw new Error(`index.html is missing ${snippet}`)
  }
}

if (index.includes('wilsonryan-hue.github.io')) {
  throw new Error('index.html still points at github.io instead of www.tchworks.co.uk')
}

if (live.shop !== shop) {
  throw new Error(`live.json shop target is ${live.shop}, expected ${shop}`)
}

console.log('Build verification passed: TCH redirect and shop target are valid.')
