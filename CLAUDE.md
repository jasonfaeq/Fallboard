# CLAUDE.md

All project instructions live in AGENTS.md (shared with Codex and Antigravity). Follow it.

@AGENTS.md

## Claude-specific notes

- Jason's working copy is on his Windows PC: `C:\Users\Jason\Main Folders\Projects\Fallboard`.
  Edit files there directly; don't keep a diverging copy.
- DJ Trainer (`C:\Users\Jason\Main Folders\Projects\DJ Trainer`) is reference only: read it,
  never write to it. Other agent sessions work in it and its working tree often has
  uncommitted changes, so read the files as they are and don't rely on its git history.
- If a claude.ai project mirrors `docs/VISION.md`, `docs/CURRICULUM.md`, `docs/ROADMAP.md`
  and `docs/DECISIONS.md`, update the project copies when you change those files.
- Hooks (`.claude/settings.json`, ported from DJ Trainer 2026-10-09): SessionStart runs
  `npm run brief`; a Bash guard blocks dev servers; a Stop hook runs tsc and validate once
  code changed. If a hook blocks you wrongly, say so in your summary rather than working
  around it. The guard matches the command text, so a command that only mentions a
  dev-server command or `start.bat` (in an `echo` or a heredoc) is blocked too.
- Playwright on Jason's PC: the bundled Chromium is not installed. Configure tests to use the
  installed Edge (`channel: 'msedge'`). Don't run `npx playwright install` without asking
  (≈150 MB download).
