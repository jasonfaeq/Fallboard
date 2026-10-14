// Check the built-in scores without starting a browser: each is MusicXML with a title, a composer,
// a licence we may ship (MUSIC.md) and at least one measure, and is listed in src/reader/library.ts.
// The old text-notation piece validator is parked in parked/midi-trainer/tools/validate.mjs.
import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const dir = join(root, 'src/content/scores')
const library = readFileSync(join(root, 'src/reader/library.ts'), 'utf8')
const files = readdirSync(dir).filter((f) => /\.(musicxml|xml)$/.test(f))
let errors = 0
for (const file of files) {
  const xml = readFileSync(join(dir, file), 'utf8')
  const problems = []
  if (!/<score-partwise[\s>]/.test(xml)) problems.push('not a partwise MusicXML score')
  if (!/<work-title>[^<]+<\/work-title>|<movement-title>[^<]+<\/movement-title>/.test(xml)) problems.push('no title')
  if (!/<creator type="composer">[^<]+<\/creator>/.test(xml)) problems.push('no composer')
  const rights = /<rights>([^<]+)<\/rights>/.exec(xml)?.[1] ?? ''
  if (!/^(public-domain|original)/.test(rights)) problems.push(`licence "${rights}" is not public-domain or original`)
  if (!/<measure[\s>]/.test(xml)) problems.push('no measures')
  if (!library.includes(`content/scores/${file}?raw`)) problems.push('not listed in src/reader/library.ts')
  for (const p of problems) console.error(`${file}: ${p}`)
  errors += problems.length
}
console.log(`${files.length} built-in score(s) checked · ${errors} error(s)`)
process.exitCode = errors ? 1 : 0
