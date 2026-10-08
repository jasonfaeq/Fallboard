// Stop hook: when Claude finishes a turn with changed code, run the cheap part of the
// definition of done (tsc + mission validator) once. Silent on success; on failure it
// returns the first error lines (exit 2) so Claude fixes them before stopping.
// Skips when no .ts/.tsx/.mjs file changed, or when nothing changed since the last pass.
import { execFileSync, spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { createHash } from 'node:crypto'

let input = {}
try { input = JSON.parse(readFileSync(0, 'utf8') || '{}') } catch {}
if (input.stop_hook_active) process.exit(0) // already blocked once this turn: don't loop

const root = resolve(process.env.CLAUDE_PROJECT_DIR || input.cwd || process.cwd())
let changed
try {
  changed = execFileSync('git', ['status', '--porcelain', '--untracked-files=all'], { cwd: root, encoding: 'utf8' })
    .split('\n').map((l) => l.slice(3).replace(/^"|"$/g, '').split(' -> ').pop())
    .filter((f) => /^(src|tests|tools)\/.*\.(tsx?|mjs)$/.test(f))
} catch { process.exit(0) } // no git: don't get in the way
if (!changed.length) process.exit(0)

// Fingerprint of the changed files; skip if identical to the last passing run
const hash = createHash('sha1')
for (const f of changed.sort()) {
  const p = join(root, f)
  hash.update(f + (existsSync(p) ? statSync(p).mtimeMs + ':' + statSync(p).size : ':gone'))
}
const fp = hash.digest('hex')
const cacheDir = join(root, 'node_modules', '.cache', 'piano-hooks')
const cacheFile = join(cacheDir, 'stop-check')
try { if (readFileSync(cacheFile, 'utf8') === fp) process.exit(0) } catch {}

const run = (args) => spawnSync(process.execPath, args, { cwd: root, encoding: 'utf8', timeout: 170_000 })
const head = (s, n) => {
  const lines = s.trim().split('\n')
  return lines.slice(0, n).join('\n') + (lines.length > n ? `\n… ${lines.length - n} more line(s)` : '')
}

const tsc = run([join(root, 'node_modules/typescript/bin/tsc'), '--noEmit', '--pretty', 'false'])
if (tsc.status !== 0) {
  console.error('Type-check failed (tsc --noEmit). Fix before finishing:\n' + head(tsc.stdout + tsc.stderr, 30))
  process.exit(2)
}
if (changed.some((f) => /^src\/(content|game)\/|^tools\/validate/.test(f))) {
  const val = run([join(root, 'tools/validate.mjs')])
  if (val.status !== 0) {
    const errs = (val.stdout + val.stderr).split('\n').filter((l) => /ERROR|Error|error\(s\)/.test(l)).join('\n')
    console.error('Mission validation failed (npm run validate):\n' + head(errs, 30))
    process.exit(2)
  }
}
try { mkdirSync(cacheDir, { recursive: true }); writeFileSync(cacheFile, fp) } catch {}
process.exit(0)
