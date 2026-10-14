// Validate typed piece data without starting a browser or adding a runtime dependency.
import { mkdtempSync, mkdirSync, readdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, resolve, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import ts from 'typescript'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const pieces = readdirSync(join(root, 'src/content/pieces')).filter((f) => f.endsWith('.ts'))
const temp = mkdtempSync(join(tmpdir(), 'piano-score-check-'))
let errors = 0
let pending = 0
try {
  writeFileSync(join(temp, 'package.json'), '{"type":"module"}')
  for (const relative of ['engine/input.ts', 'engine/score.ts', ...pieces.map((f) => `content/pieces/${f}`)]) {
    const source = readFileSync(join(root, 'src', relative), 'utf8')
    const code = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText
      .replace(/(from\s+['"])(\.[^'"]+)(['"])/g, '$1$2.js$3')
    const target = join(temp, relative.replace(/\.ts$/, '.js'))
    mkdirSync(dirname(target), { recursive: true })
    writeFileSync(target, code)
  }
  const ids = new Set()
  for (const file of pieces) {
    try {
      const { default: score } = await import(pathToFileURL(join(temp, 'content/pieces', file.replace(/\.ts$/, '.js'))).href)
      if (score.id !== file.slice(0, -3) || ids.has(score.id)) throw new Error('Piece id must be unique and match its filename')
      ids.add(score.id)
      if (!score.composer || !score.sections.length || !score.practice.length || !score.soundNotes.length) throw new Error('Piece metadata/practice plan is incomplete')
      if (!score.licence.startsWith('public-domain') && !score.licence.startsWith('original')) throw new Error('Unsupported shipped composition licence')
      if (!score.verified) pending++
    } catch (e) {
      errors++
      console.error(`${file}: ${e.message}`)
    }
  }
} finally {
  if (dirname(temp) !== resolve(tmpdir())) throw new Error('Unexpected validation temp path')
  rmSync(temp, { recursive: true, force: true })
}
console.log(`${pieces.length} piece(s) checked · ${errors} error(s) · ${pending} awaiting Jason's note confirmation · mission validator still planned`)
process.exitCode = errors ? 1 : 0
