# Porting from DJ Trainer

What to bring across from the sibling project, and how. Written 2026-10-04 from a read of DJ
Trainer's docs, `package.json`, hooks config and the imports of `src/game/`; the UI and test
code were not read, so treat those rows as pointers and check each file before copying.

**Source:** `C:\Users\Jason\Main Folders\Projects\DJ Trainer` — **read only.** Never edit,
build or run tests there from this project. Other agent sessions work in it and its working
tree often has uncommitted changes; copy files as they are on disk.

Don't read there: `DJ-Trainer.html`, `package-lock.json`, `dist/`, `node_modules/`,
`.venv-analysis/`, `.analysis-temp/`, audio files. Grep `src/App.tsx` instead of reading it.

## Why not copy the whole folder (D-01)

Every file in DJ Trainer's mission engine (`src/game/v2/`) imports its two-deck audio engine
(`DeckId`, `Engine`, `Rig`, `PHRASE`, track sections). Deleting the DJ engine would leave
almost nothing compiling. So the **design** is ported and the code is rewritten around notes,
one piece at a time, with the build passing after each step.

## Copy (ROADMAP Phase 0)

| File | Change |
|---|---|
| `package.json` | name → `piano-trainer`; keep the scripts (`dev`, `build`, `preview`, `test`, `validate`, `check`, `brief`) and dependencies; remove nothing else until it's known to be unused |
| `vite.config.ts`, `tsconfig.json`, `index.html`, `tests/tsconfig.json` | titles/names only |
| `start.bat` | name only |
| `playwright.config.ts` | set `channel: 'msedge'` in `use` (Jason's PC has no bundled Chromium); pick a port that doesn't clash with DJ Trainer's 4173/4174 |
| `.gitignore` | drop the music/analysis entries; add `public/scores/` |
| `tools/brief.mjs` | as is. It depends on the exact formats of `docs/ROADMAP.md` (`## Phase …`, `- [ ]`) and `docs/DECISIONS.md` (`**D-nn · date · title**`) — keep them |
| `.claude/settings.json` + `.claude/hooks/*.mjs` | read the two hook scripts first; replace the DJ-specific `deny` paths; keep SessionStart brief, the Bash guard and the Stop check |
| `tools/validate.mjs` | copy once `game/validate.ts` exists here. It is a 38-line runner that loads `/src/game/v2/validate.ts` through Vite and passes it the tag glossary and the curated tracks: change the path, read the glossary from CURRICULUM.md › Skill tags, pass the pieces instead of tracks |
| `src/game/progress.ts` | storage keys `djtrainer.*` → `pianotrainer.*`; new rank names |
| `src/game/career.ts` | its one import is `MissionType` from `./v2/mission` — point it at this project's mission types |

## Rewrite, using DJ Trainer as the pattern

Read the DJ file for the idea, then write the piano version against notes and a transport.

| DJ Trainer | What to take from it | Becomes |
|---|---|---|
| `src/game/v2/snapshot.ts` | one read-only snapshot per frame on the audio clock; events stamped with what the player *heard* | `game/snapshot.ts` |
| `src/game/v2/step.ts` | step lifecycle, `sequence` / `parallel` | `game/step.ts` |
| `src/game/v2/scoring.ts`, `src/game/core.ts` | `gradeMs`, weighted score, stars, grades, `Hud` / `Run` types | `game/scoring.ts`, `game/core.ts` |
| `src/game/v2/mission.ts` | `MissionSpec`, `defineMission`, the runner, results | `game/mission.ts` |
| `src/game/v2/level.ts` | level flow as a state machine outside React | `game/level.ts` (count-in → steps → ending) |
| `src/game/v2/bot.ts` | bots send inputs through the normal path; Watch mode | `game/bot.ts` + `playScore()` |
| `src/game/v2/gig.ts`, `src/content/templates/gig.ts` | crowd meter, streak, encore, results rows; a `define…` helper that builds steps from a list | `game/recital.ts` |
| `src/game/v2/validate.ts` | mission file checks | `game/validate.ts` |
| `src/content/index.ts` | glob registry of mission files | same |
| `src/content/templates/*.ts` | how a template is shaped (label, scoring, tips, weight) | new templates (MISSIONS.md) |
| `src/engine/input.ts` | Web MIDI access and hot-plug, MIDI monitor log, keyboard fallback, input timestamps | `engine/input.ts` (drop the Inpulse mapping and learn mode) |
| `src/engine/audio.ts` | AudioContext setup, output-latency maths, the anchored position model (`Deck.rebase`, `positionAt`, `beatAt`), metronome clicks | `engine/audio.ts` `Transport` |
| `src/engine/sfx.ts`, `src/ui/sfxFeedback.ts` | synthesised feedback sounds scheduled on the beat | later (Phase 4) |
| `src/game/crowd.ts`, `src/ui/Crowd.tsx` | combo + crowd as display-only feedback | later (Phase 2–4) |
| `src/ui/Results.tsx`, `src/ui/CareerScreen.tsx` | results tally, career map | UI for Phase 1–2 |
| `tests/e2e/helpers.ts`, `tests/e2e/*.spec.ts` | power-on, start a mission by id, wait on the audio clock, expect results | this project's test helpers |
| `docs/MISSIONS.md`, `docs/ARCHITECTURE.md` | the fuller, as-built description of all of the above | reference while building |

## Leave behind

Decks and mixer (`Deck`, `rig.ts`), `library.ts`, `gridcheck.ts`, `synth.ts`, `echo.ts`,
`src/content/tracks.ts`, every mission in `src/content/venues/`, the DJ templates' logic
(beatmatching, EQ, fades, transitions), waveform / console / mixer UI, `src/game/guide.ts`,
the Python tools in `tools/`, `public/music/`, and the DJ-only docs (`CONTROLLER.md`,
`SONGS.md`, `PROMPTS.md`, its `MUSIC.md` and `CURRICULUM.md`).

## Lessons DJ Trainer already paid for

- Judge **state the audience hears**, not button events, and stamp inputs with the beat the
  player *heard* (input time minus output latency).
- Compute position from anchors on the audio clock; re-anchor on every speed change.
- Bots must use the same input path as the player, or tests prove nothing.
- Keep the level flow out of React.
- Docs first, one decision per real choice, a `brief` script so each new chat starts small.
- When several agent sessions run tests at once they wipe each other's `dist/` and
  `test-results/`. Give a session its own port and output folders if that happens.
