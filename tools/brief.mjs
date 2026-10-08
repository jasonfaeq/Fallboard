// npm run brief — a ~1 KB orientation for a new agent chat, so it doesn't have to read
// the whole ROADMAP and DECISIONS up front. Claude gets this automatically (SessionStart hook);
// Codex / Antigravity: run it first. Prints: git state, open items of the lowest open phase,
// one line per decision.
import { readFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const read = (p) => { try { return readFileSync(resolve(root, p), 'utf8') } catch { return '' } }
const git = (...args) => {
  try { return execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trimEnd() }
  catch { return '' }
}
const out = []

// Git
const branch = git('branch', '--show-current')
const status = git('status', '--short').split('\n').filter(Boolean)
out.push(`## Repo: branch ${branch || '?'} · ${status.length} uncommitted file(s)`)
out.push(...status.slice(0, 12).map((s) => '  ' + s))
if (status.length > 12) out.push(`  … +${status.length - 12} more`)
const log = git('log', '--oneline', '-3')
if (log) out.push('Last commits:', ...log.split('\n').map((s) => '  ' + s))

// Roadmap: unchecked items of the lowest phase that still has any
const phases = read('docs/ROADMAP.md').split(/^(?=## )/m).filter((s) => s.startsWith('## '))
const open = phases.find((p) => /^- \[ \]/m.test(p))
if (open) {
  const title = open.split('\n')[0].replace(/^## /, '')
  const items = [...open.matchAll(/^- \[ \] (.+)$/gm)].map((m) => m[1].replace(/\*\*/g, '').trim())
  const done = (open.match(/^- \[x\]/gim) || []).length
  out.push('', `## Roadmap — ${title}: ${items.length} open, ${done} done (details: docs/ROADMAP.md)`)
  out.push(...items.map((s) => '  - ' + (s.length > 140 ? s.slice(0, 137) + '…' : s)))
}

// Decisions index
const decisions = [...read('docs/DECISIONS.md').matchAll(/^\*\*(D-\d+) · [\d-]+ · (.+?)\*\*/gm)]
if (decisions.length) {
  out.push('', `## Decisions (${decisions.length}; open docs/DECISIONS.md only for one that touches your task)`)
  out.push(...decisions.map((m) => `  ${m[1]} ${m[2]}`))
}

console.log(out.join('\n'))
