// PreToolUse(Bash) hook: block commands that never return (dev servers) or dump huge
// files into the context. Exit 2 = blocked; the message tells Claude what to do instead.
import { readFileSync } from 'node:fs'

let cmd = ''
try { cmd = JSON.parse(readFileSync(0, 'utf8')).tool_input?.command ?? '' } catch { process.exit(0) }

const rules = [
  [/\bnpm\s+(run\s+)?(dev|preview|start)\b|\bstart\.bat\b|(^|[;&|]\s*)(npx\s+)?vite(\s+(dev|serve|preview))?\s*($|[;&|])/,
    'Dev/preview servers never exit and hang the session. Use `npm test -- --grep "<name>"` (Playwright starts and stops its own server), or ask Jason to check it in the browser.'],
  [/\b(cat|type|less|more|head|tail|Get-Content|gc)\b[^|;&]*(package-lock\.json|dist[\\/]|node_modules[\\/]|test-results[\\/]|\.(flac|mp3|wav|m4a|ogg)\b)/i,
    'That file is huge or binary and would flood the context. Search it with a targeted grep instead, or leave it alone.'],
]
for (const [re, msg] of rules) if (re.test(cmd)) { console.error('Blocked by .claude/hooks/guard-bash.mjs: ' + msg); process.exit(2) }
process.exit(0)
